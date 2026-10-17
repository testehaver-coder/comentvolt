-- 0007: Add modular feature flags to campaigns (12 independent functions).
-- Features are stored as a JSON object with boolean toggles. All default to true (enabled)
-- for backwards compatibility with existing campaigns.

ALTER TABLE campaigns ADD COLUMN features TEXT DEFAULT '{}';

-- indexes: none needed (JSON search is linear, but features is always hydrated with the campaign).
