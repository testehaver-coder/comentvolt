// Postiz single sign-on: Postiz signs a short-lived ticket with the shared POSTIZ_SSO_SECRET, the
// embedded UI trades it for a session token, and the owner routes accept that session token.

import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { issueSession, verifySession, verifyTicket } from "../src/auth/session";
import { isOwner } from "../src/routes/http";
import type { Env } from "../src/types";

const SECRET = "shared-sso-secret";
const NOW = 1_800_000_000;

/** Same recipe the Postiz Automations page uses (Node crypto, base64url, no padding). */
function postizTicket(exp: number, secret = SECRET): string {
  const sig = createHmac("sha256", secret).update(`sso.${exp}`).digest("base64url");
  return `sso.${exp}.${sig}`;
}

function env(over: Partial<Env> = {}): Env {
  return { OWNER_TOKEN: "owner-token", POSTIZ_SSO_SECRET: SECRET, ...over } as Env;
}

function req(token: string): [Request, URL] {
  const url = new URL("https://chatmany.test/api/status");
  return [new Request(url, { headers: { authorization: `Bearer ${token}` } }), url];
}

describe("verifyTicket", () => {
  it("accepts a fresh ticket signed by Postiz", async () => {
    expect(await verifyTicket(SECRET, postizTicket(NOW + 60), NOW)).toBe(true);
  });

  it("rejects an expired ticket", async () => {
    expect(await verifyTicket(SECRET, postizTicket(NOW - 1), NOW)).toBe(false);
  });

  it("rejects a ticket that lives too long to be a one-off pass", async () => {
    expect(await verifyTicket(SECRET, postizTicket(NOW + 3600), NOW)).toBe(false);
  });

  it("rejects a ticket signed with another secret", async () => {
    expect(await verifyTicket(SECRET, postizTicket(NOW + 60, "other"), NOW)).toBe(false);
  });

  it("rejects a tampered expiry", async () => {
    const [, , sig] = postizTicket(NOW + 60).split(".");
    expect(await verifyTicket(SECRET, `sso.${NOW + 90}.${sig}`, NOW)).toBe(false);
  });

  it("rejects garbage and missing secrets", async () => {
    expect(await verifyTicket(SECRET, "nope", NOW)).toBe(false);
    expect(await verifyTicket("", postizTicket(NOW + 60), NOW)).toBe(false);
  });
});

describe("sessions", () => {
  it("issues a session that verifies until it expires", async () => {
    const token = await issueSession(SECRET, NOW);
    expect(await verifySession(SECRET, token, NOW + 60)).toBe(true);
    expect(await verifySession(SECRET, token, NOW + 13 * 3600)).toBe(false);
  });

  it("does not accept a ticket as a session", async () => {
    expect(await verifySession(SECRET, postizTicket(NOW + 60), NOW)).toBe(false);
  });
});

describe("isOwner", () => {
  it("still accepts the owner token", async () => {
    expect(await isOwner(...req("owner-token"), env())).toBe(true);
  });

  it("accepts a live session token", async () => {
    const token = await issueSession(SECRET);
    expect(await isOwner(...req(token), env())).toBe(true);
  });

  it("rejects session tokens when single sign-on is not configured", async () => {
    const token = await issueSession(SECRET);
    expect(await isOwner(...req(token), env({ POSTIZ_SSO_SECRET: undefined }))).toBe(false);
  });

  it("rejects anything else", async () => {
    expect(await isOwner(...req("wrong"), env())).toBe(false);
  });
});
