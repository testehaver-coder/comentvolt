// Instagram connection owned by Postiz: chatmany pulls the token of the Instagram channel the
// owner connected in Postiz instead of running its own OAuth flow.

import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { isPostizManaged, syncInstagramFromPostiz } from "../src/auth/postiz";
import { getAuth, kvGet, saveAuth } from "../src/db";
import type { Env } from "../src/types";
import { makeTestDb } from "./helpers/fakeD1";

const SECRET = "shared-secret";
// What Postiz's /chatmany/instagram expects: proof of the secret, never the secret itself.
const BRIDGE = createHmac("sha256", SECRET).update("bridge").digest("base64url");
const ACCOUNT = {
  ig_user_id: "17841400000000001",
  username: "volt.oficial",
  name: "VOLT",
  profile_picture_url: "https://cdn.example/volt.jpg",
  access_token: "IGAA-token-from-postiz",
  expires_at: 1_900_000_000,
};

let env: Env;
let calls: { url: string; auth: string | null }[];

function fakeFetch(status: number, body: unknown): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), auth: new Headers(init?.headers).get("authorization") });
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
}

const sync = (body: unknown, status = 200) => syncInstagramFromPostiz(env, { force: true, fetchFn: fakeFetch(status, body) });

beforeEach(() => {
  calls = [];
  env = {
    DB: makeTestDb(),
    POSTIZ_URL: "http://localhost:3100",
    POSTIZ_SSO_SECRET: SECRET,
  } as unknown as Env;
});

describe("isPostizManaged", () => {
  it("needs both the Postiz address and the shared secret", () => {
    expect(isPostizManaged(env)).toBe(true);
    expect(isPostizManaged({ ...env, POSTIZ_URL: undefined })).toBe(false);
    expect(isPostizManaged({ ...env, POSTIZ_SSO_SECRET: undefined })).toBe(false);
  });
});

describe("syncInstagramFromPostiz", () => {
  it("does nothing when Postiz is not configured", async () => {
    const res = await syncInstagramFromPostiz({ ...env, POSTIZ_URL: undefined }, { fetchFn: fakeFetch(200, {}) });
    expect(res.status).toBe("off");
    expect(calls).toHaveLength(0);
  });

  it("stores the Instagram account connected in Postiz, proving the secret without sending it", async () => {
    const res = await sync({ accounts: [ACCOUNT] });
    expect(res.status).toBe("synced");
    expect(calls[0]).toEqual({ url: "http://localhost:3100/chatmany/instagram", auth: `Bearer ${BRIDGE}` });
    expect(calls[0]!.auth).not.toContain(SECRET);
    const auth = await getAuth(env.DB);
    expect(auth?.access_token).toBe(ACCOUNT.access_token);
    expect(auth?.ig_user_id).toBe(ACCOUNT.ig_user_id);
    expect(auth?.username).toBe(ACCOUNT.username);
    expect(auth?.expires_at).toBe(ACCOUNT.expires_at);
  });

  it("keeps the account already in use when Postiz has several", async () => {
    await saveAuth(env.DB, { access_token: "old", expires_at: 1, ig_user_id: "second" });
    const second = { ...ACCOUNT, ig_user_id: "second", access_token: "second-token" };
    await sync({ accounts: [ACCOUNT, second] });
    expect((await getAuth(env.DB))?.access_token).toBe("second-token");
  });

  it("replaces a connection not made through Postiz with the Postiz account", async () => {
    await saveAuth(env.DB, { access_token: "preview", expires_at: 1, ig_user_id: "preview" });
    expect((await sync({ accounts: [ACCOUNT] })).status).toBe("synced");
    expect((await getAuth(env.DB))?.ig_user_id).toBe(ACCOUNT.ig_user_id);
  });

  it("reports unchanged when the token is already current", async () => {
    await sync({ accounts: [ACCOUNT] });
    expect((await sync({ accounts: [ACCOUNT] })).status).toBe("unchanged");
  });

  it("clears the connection when Instagram was removed from Postiz", async () => {
    await sync({ accounts: [ACCOUNT] });
    expect((await sync({ accounts: [] })).status).toBe("cleared");
    expect(await getAuth(env.DB)).toBeNull();
  });

  it("does not hop to another Postiz account when the one in use disappears", async () => {
    await sync({ accounts: [ACCOUNT] });
    const other = { ...ACCOUNT, ig_user_id: "other", access_token: "other-token" };
    expect((await sync({ accounts: [other] })).status).toBe("cleared");
    expect(await getAuth(env.DB)).toBeNull();
  });

  it("never removes a connection that Postiz did not create", async () => {
    await saveAuth(env.DB, { access_token: "own-oauth", expires_at: 1, ig_user_id: "x" });
    expect((await sync({ accounts: [] })).status).toBe("unchanged");
    expect((await getAuth(env.DB))?.access_token).toBe("own-oauth");
  });

  it("leaves the stored connection alone when Postiz fails", async () => {
    await saveAuth(env.DB, { access_token: "keep", expires_at: 1, ig_user_id: "x" });
    expect((await sync({ error: "boom" }, 500)).status).toBe("error");
    expect((await getAuth(env.DB))?.access_token).toBe("keep");
  });

  it("ignores malformed answers instead of throwing", async () => {
    await saveAuth(env.DB, { access_token: "keep", expires_at: 1, ig_user_id: "x" });
    expect((await sync({ accounts: "nope" })).status).toBe("error");
    expect((await sync({ accounts: [{ ig_user_id: "y" }] })).status).toBe("error");
    expect((await getAuth(env.DB))?.access_token).toBe("keep");
    const throwing = (async () => {
      throw new Error("network down");
    }) as typeof fetch;
    const res = await syncInstagramFromPostiz(env, { force: true, fetchFn: throwing });
    expect(res).toEqual({ status: "error", detail: "network down" });
  });

  it("checks Postiz at most once per interval, even after a failure", async () => {
    const failing = fakeFetch(500, {});
    await syncInstagramFromPostiz(env, { fetchFn: failing, maxAgeS: 900 });
    expect((await syncInstagramFromPostiz(env, { fetchFn: failing, maxAgeS: 900 })).status).toBe("skipped");
    expect(calls).toHaveLength(1);
    expect(await kvGet(env.DB, "postiz_sync_at")).not.toBeNull();
  });
});
