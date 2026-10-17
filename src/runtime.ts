// Builds the per-invocation runtime (API client + send queue + engine) from stored auth.
// Returns null when no account is connected or the token has lapsed.

import { InstagramClient } from "./api/client";
import { SendQueue } from "./queue/queue";
import { Engine } from "./engine/engine";
import { getAuth, now } from "./db";
import type { AuthRow, Env } from "./types";

export interface Runtime {
  client: InstagramClient;
  queue: SendQueue;
  engine: Engine;
  auth: AuthRow;
  igUserId: string;
}

export async function buildRuntime(env: Env): Promise<Runtime | null> {
  const auth = await getAuth(env.DB);
  if (!auth) {
    console.warn("[chatmany] no Instagram account connected; skipping.");
    return null;
  }
  if (auth.expires_at <= now()) {
    console.warn("[chatmany] access token expired; owner must reconnect. Skipping.");
    return null;
  }
  const igUserId = auth.ig_user_id ?? "me";
  const client = new InstagramClient(auth.access_token, env.GRAPH_VERSION, igUserId);
  const queue = new SendQueue();
  const engine = new Engine(env.DB, client, queue, auth.ig_user_id ?? undefined, publicUrl(env) ?? undefined);
  return { client, queue, engine, auth, igUserId };
}

/**
 * This Worker's public https address — PUBLIC_URL, or else the origin of REDIRECT_URI once that
 * points at the real Worker (the shipped placeholder does not count). Null when unknown: tracked
 * reward links, and so follow-ups, then stay off.
 */
export function publicUrl(env: Env): string | null {
  for (const candidate of [env.PUBLIC_URL, env.REDIRECT_URI]) {
    if (!candidate || /REPLACE/i.test(candidate)) continue;
    try {
      const url = new URL(candidate);
      if (url.protocol === "https:") return url.origin;
    } catch {
      /* not a URL: try the next one */
    }
  }
  return null;
}

const MIN_POLL_SECONDS = 30;
const DEFAULT_POLL_SECONDS = 90;
const DEFAULT_RECONCILE_SECONDS = 900; // 15 min

/**
 * How often the cron should poll, in seconds — or null to not poll at all.
 *
 * In polling mode this is the primary transport, so it runs at POLL_INTERVAL_SECONDS (~90s).
 *
 * In webhook mode push is the primary transport, but polls do NOT stop: they drop to a slow
 * reconciliation sweep. Webhooks are fire-and-forget — Meta retries a delivery a few times and
 * then drops it, and a Worker that was rate-limited, mid-deploy, or briefly erroring silently
 * loses those leads with nothing to notice or recover them. Polling re-reads recent comments and
 * messages, so anything a webhook missed still gets picked up a few minutes later.
 *
 * Running both is safe precisely because the engine is idempotent: processed_comments, send_claims
 * and the per-person conversation dedup mean a comment already handled via webhook is recognised
 * and skipped, never re-sent. Set WEBHOOK_RECONCILE_SECONDS to "off" (or 0) for pure push.
 */
export function pollIntervalSeconds(env: Env): number | null {
  if (env.MODE !== "webhook") {
    return Math.max(MIN_POLL_SECONDS, Number(env.POLL_INTERVAL_SECONDS) || DEFAULT_POLL_SECONDS);
  }
  const raw = (env.WEBHOOK_RECONCILE_SECONDS ?? "").trim().toLowerCase();
  if (raw === "off" || raw === "0" || raw === "false") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.max(MIN_POLL_SECONDS, n) : DEFAULT_RECONCILE_SECONDS;
}

/** Parse an ISO-8601 timestamp (Graph `created_time`/`timestamp`) to unix seconds. */
export function toUnixSeconds(iso: string | undefined): number {
  if (!iso) return now();
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? now() : Math.floor(ms / 1000);
}
