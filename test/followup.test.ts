// Follow-up DM for people who got the link but never opened it. Instagram only allows messaging a
// commenter again after they interact (the tap on our button counts) and within 24 hours of that,
// so the follow-up is sent after a configurable delay, never past 23 hours from the delivery (which
// happens right after their tap), and only when the tracked link shows no click.

import { beforeEach, describe, expect, it } from "vitest";
import { ConfigError, validateCampaign } from "../src/config";
import { Engine } from "../src/engine/engine";
import { SendQueue } from "../src/queue/queue";
import { eventCountsByType, getConversation, upsertCampaign } from "../src/db";
import { handleTrackedLink } from "../src/routes/links";
import type { Campaign, Env, NormalizedComment, NormalizedMessage } from "../src/types";
import { makeTestDb } from "./helpers/fakeD1";
import { FakeClient } from "./helpers/fakeClient";

const PUBLIC = "https://chatmany.example.workers.dev";
const T = Math.floor(Date.now() / 1000);
const fastQueue = () => new SendQueue({ minIntervalMs: 0, maxRetries: 0, baseBackoffMs: 0 });

function campaign(over: Partial<Campaign> = {}): Campaign {
  return {
    campaign_id: "c1",
    media_id: "media1",
    keywords: ["Link"],
    exclude: [],
    reward: { type: "link", value: "https://volt.com/promo" },
    copy: { opening: "tap", opening_button: "Go", delivery: "aqui {reward}" },
    followup: { enabled: true, delay_minutes: 60, text: "Esqueceu? {reward}" },
    ...over,
  };
}

const comment: NormalizedComment = {
  kind: "comment", comment_id: "cm1", igsid: "user1", username: "user1", text: "Link", media_id: "media1", timestamp: T,
};
const tap: NormalizedMessage = { kind: "message", igsid: "user1", timestamp: T + 100, payload: "OPENING_TAP:c1" };

let db: D1Database;
let client: FakeClient;
let engine: Engine;

async function deliver(over: Partial<Campaign> = {}) {
  await upsertCampaign(db, campaign(over), true);
  await engine.handleComment(comment);
  await engine.handleMessage(tap);
}

const lastText = () => (client.calls.text.at(-1) as { text: string }).text;
const trackedUrl = (text: string) => text.match(/https:\/\/\S+\/r\/\w+/)?.[0];

beforeEach(() => {
  db = makeTestDb();
  client = new FakeClient();
  engine = new Engine(db, client.asClient(), fastQueue(), undefined, PUBLIC);
});

describe("tracked delivery link", () => {
  it("swaps the reward link for a tracked one when a follow-up is set", async () => {
    await deliver();
    const url = trackedUrl(lastText());
    expect(url).toMatch(new RegExp(`^${PUBLIC}/r/`));
    expect((await getConversation(db, "user1", "c1"))?.delivered_at).toBeGreaterThan(0);
  });

  it("keeps the plain link when there is no follow-up", async () => {
    await deliver({ followup: undefined });
    expect(lastText()).toBe("aqui https://volt.com/promo");
  });

  it("keeps the plain link when chatmany has no public address to track with", async () => {
    engine = new Engine(db, client.asClient(), fastQueue());
    await deliver();
    expect(lastText()).toBe("aqui https://volt.com/promo");
  });

  it("redirects to the real link and records the first click", async () => {
    await deliver();
    const token = trackedUrl(lastText())!.split("/r/")[1]!;
    const env = { DB: db } as unknown as Env;
    const res = await handleTrackedLink(env, token);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://volt.com/promo");
    await handleTrackedLink(env, token);
    expect((await eventCountsByType(db, "c1", 0)).link_clicked).toBe(1);
    expect((await handleTrackedLink(env, "nope")).status).toBe(404);
  });
});

describe("follow-up", () => {
  it("is sent once the delay passes without a click, and only once", async () => {
    await deliver();
    const delivered = (await getConversation(db, "user1", "c1"))!.delivered_at!;
    expect(await engine.sendDueFollowups(delivered + 30 * 60)).toBe(0); // too early
    expect(await engine.sendDueFollowups(delivered + 61 * 60)).toBe(1);
    expect(lastText()).toMatch(new RegExp(`^Esqueceu\\? ${PUBLIC}/r/`));
    expect(await engine.sendDueFollowups(delivered + 120 * 60)).toBe(0);
    expect((await eventCountsByType(db, "c1", 0)).followup_sent).toBe(1);
  });

  it("is not sent to someone who opened the link", async () => {
    await deliver();
    const token = trackedUrl(lastText())!.split("/r/")[1]!;
    await handleTrackedLink({ DB: db } as unknown as Env, token);
    const delivered = (await getConversation(db, "user1", "c1"))!.delivered_at!;
    expect(await engine.sendDueFollowups(delivered + 61 * 60)).toBe(0);
  });

  it("is never sent outside Instagram's 24-hour window", async () => {
    await deliver();
    const delivered = (await getConversation(db, "user1", "c1"))!.delivered_at!;
    expect(await engine.sendDueFollowups(delivered + 23.5 * 3600)).toBe(0);
  });

  it("is validated: a delay between 5 minutes and 23 hours and a message", () => {
    const base = campaign();
    expect(validateCampaign(base).followup).toEqual(base.followup);
    expect(() => validateCampaign({ ...base, followup: { enabled: true, delay_minutes: 2, text: "x" } })).toThrow(ConfigError);
    expect(() => validateCampaign({ ...base, followup: { enabled: true, delay_minutes: 24 * 60, text: "x" } })).toThrow(ConfigError);
    expect(() => validateCampaign({ ...base, followup: { enabled: true, delay_minutes: 60, text: "" } })).toThrow(ConfigError);
    expect(validateCampaign({ ...base, followup: { enabled: false, delay_minutes: 0, text: "" } }).followup?.enabled).toBe(false);
  });
});
