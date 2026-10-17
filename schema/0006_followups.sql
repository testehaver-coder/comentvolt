-- Follow-up DM for people who received the reward link but never opened it.
--
-- Instagram lets a business message a commenter again only after they interact (pressing our
-- opening button counts) and only within 24 hours of that interaction. Delivery happens right after
-- that press, so delivered_at doubles as the start of the window: a follow-up is sent after the
-- campaign's delay and never later than 23 hours after it.
--
-- Whether they opened the link is known from tracked_links: the reward link in the delivery DM
-- points at chatmany's /r/<token>, which records the first click and redirects to the real link.
ALTER TABLE conversations ADD COLUMN delivered_at INTEGER;
ALTER TABLE conversations ADD COLUMN followup_sent INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS tracked_links (
  token        TEXT PRIMARY KEY,
  campaign_id  TEXT NOT NULL,
  igsid        TEXT NOT NULL,
  url          TEXT NOT NULL,
  created_at   INTEGER NOT NULL,
  clicked_at   INTEGER
);
CREATE INDEX IF NOT EXISTS idx_tracked_links_convo ON tracked_links (igsid, campaign_id);
CREATE INDEX IF NOT EXISTS idx_conversations_followup ON conversations (state, followup_sent, delivered_at);
