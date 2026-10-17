// chatmany Worker entry point. `fetch` serves the OAuth onboarding + owner API routes;
// `scheduled` runs the polling crons and the daily token refresh. The UI (Section 7A) will be
// added later and served from this same Worker.

import type { Env } from "./types";
import { buildRuntime, pollIntervalSeconds } from "./runtime";
import { pollComments } from "./poller/commentPoll";
import { pollMessages } from "./poller/messagePoll";
import { refreshTokenIfDue } from "./auth/refresh";
import { claimPollSlot } from "./db";
import { handleAuthorize, handleCallback, handleDisconnect, handleStatus } from "./routes/auth";
import { handleConfigExport, handleConfigImport } from "./routes/config";
import { handleWebhookAdmin, handleWebhookEvent, handleWebhookVerify } from "./routes/webhook";
import { handleApi } from "./routes/api";
import { isOwner, json, withFrameAncestors } from "./routes/http";
import { issueSession, verifyTicket } from "./auth/session";
import { isPostizManaged, syncInstagramFromPostiz } from "./auth/postiz";
import { handleTrackedLink } from "./routes/links";

const POLL_CRON = "* * * * *";
const REFRESH_CRON = "0 3 * * *";

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const { pathname } = url;
    const method = req.method.toUpperCase();

    // --- public routes ---
    if (pathname === "/health") return json({ ok: true, mode: env.MODE });

    // OAuth onboarding. /auth/callback must stay public — Instagram itself calls it, with no
    // owner token — so the takeover guard lives in handleCallback (it refuses to overwrite an
    // existing connection with a different account). /auth/authorize is owner-only, below.
    if (pathname === "/auth/callback" && method === "GET") return handleCallback(env, url);

    // Tracked reward link (follow-ups): record the click and redirect. Public, see routes/links.ts.
    const tracked = pathname.match(/^\/r\/([A-Za-z0-9]{8,64})$/);
    if (tracked && method === "GET") return handleTrackedLink(env, tracked[1]!);

    // Postiz single sign-on: trade a ticket signed by Postiz for a session token. Public by
    // design — the signed, short-lived ticket is the credential (see auth/session.ts).
    if (pathname === "/auth/sso" && method === "POST") return handleSso(env, req);

    // Webhook (only meaningful when MODE=webhook; verification is always safe to answer).
    if (pathname === "/webhook" && method === "GET") return handleWebhookVerify(env, url);
    if (pathname === "/webhook" && method === "POST") return handleWebhookEvent(env, req);

    // --- owner-only API + admin routes ---
    if (pathname.startsWith("/api/")) {
      if (!(await isOwner(req, url, env))) return json({ error: "unauthorized" }, 401);
      return handleApi(env, req, url);
    }
    const ownerRoutes = new Set([
      "/auth/authorize",
      "/auth/status",
      "/auth/disconnect",
      "/config/import",
      "/config/export",
      "/admin/poll",
      "/admin/webhook",
    ]);
    if (ownerRoutes.has(pathname)) {
      if (!(await isOwner(req, url, env))) return json({ error: "unauthorized" }, 401);
      // With Postiz managing Instagram, connecting and disconnecting happen there, not here.
      if (isPostizManaged(env) && (pathname === "/auth/authorize" || pathname === "/auth/disconnect")) {
        return json({ error: "Instagram is connected through Postiz (Add Channel -> Instagram)." }, 409);
      }
      if (pathname === "/auth/authorize" && method === "GET") return handleAuthorize(env);
      if (pathname === "/auth/status" && method === "GET") return handleStatus(env);
      if (pathname === "/auth/disconnect" && method === "POST") return handleDisconnect(env);
      if (pathname === "/config/import" && method === "POST") return handleConfigImport(env, req);
      if (pathname === "/config/export" && method === "GET") return handleConfigExport(env);
      // Manual poll trigger for testing without waiting for cron.
      if (pathname === "/admin/poll" && method === "POST") {
        await runPoll(env, pollIntervalSeconds(env) ?? 30);
        return json({ ok: true, ran: "poll" });
      }
      // Webhook subscription status / retry (see handleWebhookAdmin).
      if (pathname === "/admin/webhook" && (method === "GET" || method === "POST")) {
        return handleWebhookAdmin(env, method);
      }
      return json({ error: "method not allowed" }, 405);
    }

    // --- web UI (static assets + SPA fallback) ---
    // Matched static files are served by the assets binding automatically; this handles
    // client-side routes by returning index.html for navigations.
    const assetRes = await env.ASSETS.fetch(req);
    if (assetRes.status !== 404) return withFrameAncestors(assetRes, env);
    if (method === "GET") {
      return withFrameAncestors(await env.ASSETS.fetch(new Request(new URL("/index.html", url.origin), req)), env);
    }
    return json({ error: "not found" }, 404);
  },

  async scheduled(event: ScheduledController, env: Env): Promise<void> {
    if (event.cron === REFRESH_CRON) {
      // Postiz owns (and refreshes) the token when it manages the connection; just follow it.
      if (isPostizManaged(env)) {
        const synced = await syncInstagramFromPostiz(env, { force: true });
        console.log(`[chatmany] Postiz Instagram sync: ${synced.status}${synced.detail ? ` (${synced.detail})` : ""}`);
        return;
      }
      const result = await refreshTokenIfDue(env);
      console.log(`[chatmany] token refresh: ${result.status}`);
      return;
    }
    if (event.cron === POLL_CRON) {
      // In webhook mode this drops to a slow reconciliation sweep rather than stopping — see
      // pollIntervalSeconds for why push alone loses leads. null means polling is off entirely.
      const interval = pollIntervalSeconds(env);
      if (interval === null) return;
      await runPoll(env, interval);
    }
  },
} satisfies ExportedHandler<Env>;

/** POST /auth/sso { ticket } -> { token } when the ticket was signed by Postiz and is still fresh. */
async function handleSso(env: Env, req: Request): Promise<Response> {
  if (!env.POSTIZ_SSO_SECRET) return json({ error: "single sign-on is not configured" }, 404);
  let ticket = "";
  try {
    ticket = String(((await req.json()) as { ticket?: unknown }).ticket ?? "");
  } catch {
    return json({ error: "invalid body" }, 400);
  }
  if (!(await verifyTicket(env.POSTIZ_SSO_SECRET, ticket))) return json({ error: "unauthorized" }, 401);
  return json({ token: await issueSession(env.POSTIZ_SSO_SECRET) });
}

/**
 * Run comment + message polls, honoring the caller's poll interval (>= cron granularity).
 * claimPollSlot is an atomic claim, not a plain check-then-act read/write — see its doc comment
 * in db.ts for why that distinction matters: it's what stops an overlapping cron tick or a
 * /admin/poll call racing the cron from both polling at once and double-sending a real DM.
 */
async function runPoll(env: Env, interval: number): Promise<void> {
  const claimed = await claimPollSlot(env.DB, interval);
  if (!claimed) return; // not due yet, or another invocation already claimed this slot

  // Pick up a token Postiz connected or refreshed (throttled inside; a no-op when not managed).
  const synced = await syncInstagramFromPostiz(env);
  if (synced.status === "error") console.warn(`[chatmany] Postiz Instagram sync failed: ${synced.detail}`);

  const rt = await buildRuntime(env);
  if (!rt) return;

  // Isolated so one poll can never starve the other. pollComments used to run first with no
  // guard, which meant a throw there silently skipped the message poll for that whole tick.
  try {
    await pollComments(rt, env.DB);
  } catch (e) {
    console.warn(`[chatmany] pollComments failed: ${e instanceof Error ? e.message : e}`);
  }
  try {
    await pollMessages(rt, env.DB);
  } catch (e) {
    console.warn(`[chatmany] pollMessages failed: ${e instanceof Error ? e.message : e}`);
  }
  try {
    const followups = await rt.engine.sendDueFollowups();
    if (followups > 0) console.log(`[chatmany] sent ${followups} follow-up(s)`);
  } catch (e) {
    console.warn(`[chatmany] follow-ups failed: ${e instanceof Error ? e.message : e}`);
  }
}
