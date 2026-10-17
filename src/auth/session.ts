// Postiz single sign-on. When chatmany is shown inside Postiz, the Postiz server signs a
// short-lived ticket with the shared POSTIZ_SSO_SECRET (`sso.<exp>.<sig>`, HMAC-SHA256 over
// "sso.<exp>", base64url). The embedded UI trades it at /auth/sso for a session token signed the
// same way with the "session" purpose, which the owner routes accept alongside OWNER_TOKEN — so
// someone already signed in to Postiz never has to type the owner token.

const TICKET_MAX_AGE_S = 120;
const SESSION_TTL_S = 12 * 60 * 60;

type Purpose = "sso" | "session";

const nowS = () => Math.floor(Date.now() / 1000);

function base64url(bytes: ArrayBuffer): string {
  let bin = "";
  for (const b of new Uint8Array(bytes)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sign(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return base64url(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)));
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

/** True when `token` is `<purpose>.<exp>.<sig>`, correctly signed, unexpired and not too far out. */
async function verify(secret: string, purpose: Purpose, token: string, now: number, maxAge: number): Promise<boolean> {
  if (!secret || !token) return false;
  const [kind, expRaw, sig, ...rest] = token.split(".");
  if (rest.length || kind !== purpose || !expRaw || !sig || !/^\d+$/.test(expRaw)) return false;
  const exp = Number(expRaw);
  if (exp <= now || exp > now + maxAge) return false;
  return timingSafeEqual(sig, await sign(secret, `${purpose}.${exp}`));
}

export function verifyTicket(secret: string, ticket: string, now = nowS()): Promise<boolean> {
  return verify(secret, "sso", ticket, now, TICKET_MAX_AGE_S);
}

export function verifySession(secret: string, token: string, now = nowS()): Promise<boolean> {
  return verify(secret, "session", token, now, SESSION_TTL_S);
}

/** Proof of the shared secret for Postiz's /chatmany/instagram route, so the secret itself is
 *  never sent over the network (where it could be used to mint sessions). */
export function bridgeToken(secret: string): Promise<string> {
  return sign(secret, "bridge");
}

export async function issueSession(secret: string, now = nowS()): Promise<string> {
  const exp = now + SESSION_TTL_S;
  return `session.${exp}.${await sign(secret, `session.${exp}`)}`;
}
