-- 0008: Add recommendation (upsell) DM to campaigns.
-- Recommendations are optional follow-ups sent after a delay, suggesting another product/service.
-- Like followups, they only work when chatmany is online with a public https address.

ALTER TABLE campaigns ADD COLUMN recommendations TEXT DEFAULT '{}';

-- indexes: none needed (JSON search is linear, but recommendations is always hydrated with the campaign).
