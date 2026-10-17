// "Any word" and "any post or reel" triggers, plus the guard that keeps the account's own comments
// (e.g. its public replies) from ever triggering a funnel.

import { beforeEach, describe, expect, it } from "vitest";
import { ConfigError, validateCampaign } from "../src/config";
import { Engine } from "../src/engine/engine";
import { pollComments } from "../src/poller/commentPoll";
import { SendQueue } from "../src/queue/queue";
import { getConversation, upsertCampaign } from "../src/db";
import type { Runtime } from "../src/runtime";
import { ANY_MEDIA, type Campaign, type NormalizedComment } from "../src/types";
import { makeTestDb } from "./helpers/fakeD1";
import { FakeClient } from "./helpers/fakeClient";

const OWNER = "owner-ig-id";
const T = Math.floor(Date.now() / 1000);
const fastQueue = () => new SendQueue({ minIntervalMs: 0, maxRetries: 0, baseBackoffMs: 0 });

function campaign(over: Partial<Campaign> = {}): Campaign {
  return {
    campaign_id: "c1",
    media_id: "media1",
    keywords: ["Link"],
    exclude: [],
    reward: { type: "link", value: "https://x.com/g" },
    copy: { opening: "tap", opening_button: "Go", delivery: "here {reward}" },
    ...over,
  };
}

function comment(over: Partial<NormalizedComment> = {}): NormalizedComment {
  return { kind: "comment", comment_id: "cm1", igsid: "user1", username: "user1", text: "Link please", media_id: "media1", timestamp: T, ...over };
}

let db: D1Database;
let client: FakeClient;
let engine: Engine;

beforeEach(() => {
  db = makeTestDb();
  client = new FakeClient();
  engine = new Engine(db, client.asClient(), fastQueue(), OWNER);
});

describe("any word", () => {
  it("triggers on any comment when the campaign matches any word", async () => {
    await upsertCampaign(db, campaign({ keywords: [], match_any: true }), true);
    await engine.handleComment(comment({ text: "Amei esse post!" }));
    expect(client.calls.privateReply).toHaveLength(1);
  });

  it("still honours excluded words", async () => {
    await upsertCampaign(db, campaign({ keywords: [], match_any: true, exclude: ["golpe"] }), true);
    await engine.handleComment(comment({ text: "isso é golpe" }));
    expect(client.calls.privateReply).toHaveLength(0);
  });

  it("never answers the account's own comments", async () => {
    await upsertCampaign(db, campaign({ keywords: [], match_any: true }), true);
    await engine.handleComment(comment({ igsid: OWNER, text: "Te mandei uma DM!" }));
    expect(client.calls.privateReply).toHaveLength(0);
    expect(await getConversation(db, OWNER, "c1")).toBeNull();
  });

  it("is accepted by validation without keywords, which are otherwise required", () => {
    const base = { ...campaign(), keywords: [] };
    expect(validateCampaign({ ...base, match_any: true }).match_any).toBe(true);
    expect(() => validateCampaign(base)).toThrow(ConfigError);
  });
});

describe("any post or reel", () => {
  it("triggers on a comment on any media", async () => {
    await upsertCampaign(db, campaign({ media_id: ANY_MEDIA }), true);
    await engine.handleComment(comment({ media_id: "some-other-post" }));
    expect(client.calls.privateReply).toHaveLength(1);
  });

  it("gives way to a campaign set up for that specific post", async () => {
    await upsertCampaign(db, campaign({ campaign_id: "specific", media_id: "media1" }), true);
    await upsertCampaign(db, campaign({ campaign_id: "any", media_id: ANY_MEDIA }), true);

    await engine.handleComment(comment({ comment_id: "a", media_id: "media1" }));
    expect(await getConversation(db, "user1", "specific")).not.toBeNull();
    expect(await getConversation(db, "user1", "any")).toBeNull();

    await engine.handleComment(comment({ comment_id: "b", igsid: "user2", media_id: "media2" }));
    expect(await getConversation(db, "user2", "any")).not.toBeNull();
    expect(client.calls.privateReply).toHaveLength(2);
  });

  it("is accepted by validation", () => {
    expect(validateCampaign(campaign({ media_id: ANY_MEDIA })).media_id).toBe(ANY_MEDIA);
  });

  it("makes the poller watch the account's most recent posts", async () => {
    await upsertCampaign(db, campaign({ media_id: ANY_MEDIA }), true);
    client.media = [{ id: "newest" }, { id: "older" }];
    client.comments = {
      older: [{ id: "c-old", text: "Link", from: { id: "fan", username: "fan" }, timestamp: new Date().toISOString() }],
    };
    const rt = { client: client.asClient(), engine, igUserId: OWNER } as unknown as Runtime;
    await pollComments(rt, db);
    expect(client.getMediaCalls).toBe(1);
    expect(await getConversation(db, "fan", "c1")).not.toBeNull();
  });
});

describe("public reply", () => {
  it("tags the commenter before the chosen text", async () => {
    await upsertCampaign(db, campaign({ public_reply: { enabled: true, texts: ["Te mandei na DM!"] } }), true);
    await engine.handleComment(comment({ username: "maria.silva" }));
    expect(client.calls.reply).toEqual([{ commentId: "cm1", message: "@maria.silva Te mandei na DM!" }]);
  });

  it("does not tag twice when the text already starts with the mention", async () => {
    await upsertCampaign(db, campaign({ public_reply: { enabled: true, texts: ["@maria.silva olha a DM"] } }), true);
    await engine.handleComment(comment({ username: "maria.silva" }));
    expect((client.calls.reply[0] as { message: string }).message).toBe("@maria.silva olha a DM");
  });
});
