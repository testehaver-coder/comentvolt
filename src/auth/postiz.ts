// Instagram connection owned by Postiz. When POSTIZ_URL and POSTIZ_SSO_SECRET are set, the owner
// connects Instagram once in Postiz (Add Channel -> Instagram Standalone) and chatmany pulls that
// channel's token from Postiz's internal /chatmany/instagram route, server to server, proving it
// holds the shared secret with bridgeToken(). Postiz then owns the token: it refreshes it and
// chatmany follows.

import { clearAuth, getAuth, kvGet, kvSet, now, saveAuth } from "../db";
import type { Env } from "../types";
import { bridgeToken } from "./session";

const SYNC_KEY = "postiz_sync_at";
// Set when the stored connection came from Postiz; only those are removed when Postiz drops them,
// so a connection made through chatmany's own Connect Instagram flow is never wiped by a sync.
const SOURCE_KEY = "auth_source";
const FALLBACK_TTL_S = 60 * 24 * 3600;
const TIMEOUT_MS = 5000;

interface PostizInstagramAccount {
  ig_user_id: string;
  username?: string | null;
  name?: string | null;
  profile_picture_url?: string | null;
  access_token: string;
  expires_at?: number | null;
}

export interface PostizSyncResult {
  status: "off" | "skipped" | "synced" | "unchanged" | "cleared" | "error";
  detail?: string;
}

export function isPostizManaged(env: Env): boolean {
  return !!env.POSTIZ_URL && !!env.POSTIZ_SSO_SECRET;
}

const isAccount = (a: unknown): a is PostizInstagramAccount =>
  !!a &&
  typeof (a as PostizInstagramAccount).ig_user_id === "string" &&
  typeof (a as PostizInstagramAccount).access_token === "string";

/** Never throws: a sync problem must not stop the polls or the status screen. */
export async function syncInstagramFromPostiz(
  env: Env,
  { force = false, maxAgeS = 900, fetchFn = fetch }: { force?: boolean; maxAgeS?: number; fetchFn?: typeof fetch } = {},
): Promise<PostizSyncResult> {
  if (!isPostizManaged(env)) return { status: "off" };
  try {
    const last = Number((await kvGet(env.DB, SYNC_KEY)) ?? 0);
    if (!force && now() - last < maxAgeS) return { status: "skipped" };
    // Recorded before the call, so a Postiz outage is retried once per interval, not every tick.
    await kvSet(env.DB, SYNC_KEY, String(now()));

    const res = await fetchFn(`${env.POSTIZ_URL!.replace(/\/+$/, "")}/chatmany/instagram`, {
      headers: { authorization: `Bearer ${await bridgeToken(env.POSTIZ_SSO_SECRET!)}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return { status: "error", detail: `Postiz answered HTTP ${res.status}` };
    const accounts = ((await res.json()) as { accounts?: unknown }).accounts;
    if (!Array.isArray(accounts) || !accounts.every(isAccount)) {
      return { status: "error", detail: "unexpected answer from Postiz" };
    }
    return await apply(env, accounts);
  } catch (e) {
    return { status: "error", detail: e instanceof Error ? e.message : String(e) };
  }
}

async function apply(env: Env, accounts: PostizInstagramAccount[]): Promise<PostizSyncResult> {
  const current = await getAuth(env.DB);
  const fromPostiz = (await kvGet(env.DB, SOURCE_KEY)) === "postiz";

  let account = current ? accounts.find((a) => a.ig_user_id === current.ig_user_id) : undefined;
  if (!account) {
    // The account in use is gone from Postiz (removed, disabled or needing a reconnect): drop it
    // rather than silently switching to another of the organization's accounts.
    if (current && fromPostiz) {
      await clearAuth(env.DB);
      await kvSet(env.DB, SOURCE_KEY, "");
      return { status: "cleared" };
    }
    account = accounts[0];
    if (!account) return { status: "unchanged" };
  }
  if (current && fromPostiz && current.access_token === account.access_token && current.ig_user_id === account.ig_user_id) {
    return { status: "unchanged" };
  }

  await saveAuth(env.DB, {
    access_token: account.access_token,
    expires_at: account.expires_at ?? now() + FALLBACK_TTL_S,
    ig_user_id: account.ig_user_id,
    username: account.username ?? null,
    profile_picture_url: account.profile_picture_url ?? null,
  });
  await kvSet(env.DB, SOURCE_KEY, "postiz");
  return { status: "synced" };
}
