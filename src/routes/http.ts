// Small HTTP response helpers + owner-token auth guard.

import type { Env } from "../types";
import { timingSafeEqual, verifySession } from "../auth/session";

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export function html(body: string, status = 200): Response {
  return new Response(`<!doctype html><meta charset="utf-8"><body style="font-family:system-ui;max-width:40rem;margin:3rem auto;padding:0 1rem">${body}</body>`, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export function redirect(location: string, status = 302): Response {
  // no-referrer: /auth/authorize is reached with `?token=<OWNER_TOKEN>` in the query (a plain
  // link navigation cannot set an Authorization header), so make sure that URL is never handed
  // to instagram.com in a Referer header.
  return new Response(null, { status, headers: { location, "referrer-policy": "no-referrer" } });
}

/**
 * The UI is meant to be framed only by Postiz's Automations page (POSTIZ_APP_URL). Pages get a
 * frame-ancestors policy so no other site can frame them (clickjacking); without the setting
 * nothing changes.
 */
export function withFrameAncestors(res: Response, env: Env): Response {
  if (!env.POSTIZ_APP_URL || !(res.headers.get("content-type") ?? "").includes("text/html")) return res;
  let origin: string;
  try {
    origin = new URL(env.POSTIZ_APP_URL).origin;
  } catch {
    return res;
  }
  const framed = new Response(res.body, res);
  framed.headers.set("content-security-policy", `frame-ancestors 'self' ${origin}`);
  return framed;
}

/**
 * Owner auth: the single-owner token — or, when POSTIZ_SSO_SECRET is set, a session token
 * issued by /auth/sso (see auth/session.ts) — in `Authorization: Bearer <token>` or `?token=`.
 * Returns true when authorized. Uses a constant-time compare.
 */
export async function isOwner(req: Request, url: URL, env: Env): Promise<boolean> {
  const header = req.headers.get("authorization") ?? "";
  const bearer = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  const supplied = bearer || url.searchParams.get("token") || "";
  if (env.OWNER_TOKEN && timingSafeEqual(supplied, env.OWNER_TOKEN)) return true;
  return !!env.POSTIZ_SSO_SECRET && verifySession(env.POSTIZ_SSO_SECRET, supplied);
}
