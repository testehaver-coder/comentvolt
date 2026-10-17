// Config loading + validation (Section 7). A campaign is authored in the UI (campaigns table)
// or imported from config.json. Both funnel through validateCampaign so the engine can trust
// the shape. Validation fails loudly on missing media_id / keywords.

import type { AppConfig, Campaign } from "./types";

export class ConfigError extends Error {}

/** Follow-up delay bounds, in minutes: at least 5, at most 23 h (inside Instagram's 24 h window). */
export const FOLLOWUP_MIN_DELAY = 5;
export const FOLLOWUP_MAX_DELAY = 23 * 60;

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

/** Validate + normalize one campaign object. Throws ConfigError on any invalid field. */
export function validateCampaign(input: unknown, index = 0): Campaign {
  const where = `campaigns[${index}]`;
  if (typeof input !== "object" || input === null) {
    throw new ConfigError(`${where} must be an object`);
  }
  const c = input as Record<string, unknown>;

  if (!isNonEmptyString(c.campaign_id)) {
    throw new ConfigError(`${where}.campaign_id is required`);
  }
  if (!isNonEmptyString(c.media_id)) {
    throw new ConfigError(`${where}.media_id is required`);
  }
  const matchAny = c.match_any === true;
  if (!Array.isArray(c.keywords) || !c.keywords.every(isNonEmptyString) || (!matchAny && c.keywords.length === 0)) {
    throw new ConfigError(`${where}.keywords must be a non-empty array of strings (or set match_any)`);
  }
  if (c.exclude !== undefined && (!Array.isArray(c.exclude) || !c.exclude.every(isNonEmptyString))) {
    throw new ConfigError(`${where}.exclude must be an array of strings`);
  }

  const reward = c.reward as Record<string, unknown> | undefined;
  if (
    !reward ||
    !["link", "code", "text"].includes(reward.type as string) ||
    !isNonEmptyString(reward.value)
  ) {
    throw new ConfigError(`${where}.reward must be { type: link|code|text, value: string }`);
  }

  const copy = c.copy as Record<string, unknown> | undefined;
  if (!copy || !isNonEmptyString(copy.opening) || !isNonEmptyString(copy.delivery)) {
    throw new ConfigError(`${where}.copy.opening and copy.delivery are required`);
  }

  if (c.public_reply !== undefined) {
    const pr = c.public_reply as Record<string, unknown>;
    if (typeof pr.enabled !== "boolean") {
      throw new ConfigError(`${where}.public_reply.enabled must be a boolean`);
    }
    if (pr.enabled && (!Array.isArray(pr.texts) || pr.texts.length === 0 || !pr.texts.every(isNonEmptyString))) {
      throw new ConfigError(`${where}.public_reply.texts must be a non-empty array when enabled`);
    }
  }

  let followup: Campaign["followup"];
  if (c.followup !== undefined && c.followup !== null) {
    const f = c.followup as Record<string, unknown>;
    if (typeof f.enabled !== "boolean") {
      throw new ConfigError(`${where}.followup.enabled must be a boolean`);
    }
    if (f.enabled) {
      const delay = f.delay_minutes;
      // Instagram allows the follow-up only within 24 h of the person's last interaction (the tap
      // that led to delivery), so it must land inside that window with margin to spare.
      if (typeof delay !== "number" || !Number.isInteger(delay) || delay < FOLLOWUP_MIN_DELAY || delay > FOLLOWUP_MAX_DELAY) {
        throw new ConfigError(`${where}.followup.delay_minutes must be a whole number from ${FOLLOWUP_MIN_DELAY} to ${FOLLOWUP_MAX_DELAY}`);
      }
      if (!isNonEmptyString(f.text)) {
        throw new ConfigError(`${where}.followup.text is required when the follow-up is enabled`);
      }
    }
    followup = {
      enabled: f.enabled,
      delay_minutes: typeof f.delay_minutes === "number" ? f.delay_minutes : 0,
      text: typeof f.text === "string" ? f.text : "",
    };
  }

  let recommendation: Campaign["recommendation"];
  if (c.recommendation !== undefined && c.recommendation !== null) {
    const r = c.recommendation as Record<string, unknown>;
    if (typeof r.enabled !== "boolean") {
      throw new ConfigError(`${where}.recommendation.enabled must be a boolean`);
    }
    if (r.enabled) {
      const delay = r.delay_minutes;
      if (typeof delay !== "number" || !Number.isInteger(delay) || delay < FOLLOWUP_MIN_DELAY || delay > FOLLOWUP_MAX_DELAY) {
        throw new ConfigError(`${where}.recommendation.delay_minutes must be a whole number from ${FOLLOWUP_MIN_DELAY} to ${FOLLOWUP_MAX_DELAY}`);
      }
      if (!isNonEmptyString(r.message)) {
        throw new ConfigError(`${where}.recommendation.message is required when recommendation is enabled`);
      }
      if (!isNonEmptyString(r.button_label)) {
        throw new ConfigError(`${where}.recommendation.button_label is required when recommendation is enabled`);
      }
    }
    recommendation = {
      enabled: r.enabled,
      delay_minutes: typeof r.delay_minutes === "number" ? r.delay_minutes : 0,
      message: typeof r.message === "string" ? r.message : "",
      button_label: typeof r.button_label === "string" ? r.button_label : "",
      link: typeof r.link === "string" ? r.link : undefined,
    };
  }

  let features: Campaign["features"];
  if (c.features !== undefined && c.features !== null) {
    const f = c.features as Record<string, unknown>;
    // Normalize: keep only boolean values, drop anything else so it falls back to the default (true).
    const normalized: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(f)) {
      if (typeof value === "boolean") {
        normalized[key] = value;
      }
    }
    features = normalized;
  }

  // Reflect only known fields; ignore extras so the schema can evolve.
  return {
    campaign_id: c.campaign_id,
    name: typeof c.name === "string" ? c.name : undefined,
    folder: isNonEmptyString(c.folder) ? c.folder.trim().slice(0, 60) : undefined,
    media_id: c.media_id,
    keywords: c.keywords as string[],
    match_any: matchAny,
    exclude: (c.exclude as string[] | undefined) ?? [],
    public_reply: c.public_reply as Campaign["public_reply"],
    check_follow: Boolean(c.check_follow),
    verify_follow_count: Boolean(c.verify_follow_count),
    ask_email: Boolean(c.ask_email),
    reward: { type: reward.type as Campaign["reward"]["type"], value: reward.value as string },
    // `copy` used to be cast wholesale, which meant a non-string optional field (from
    // /config/import, or a row written straight into the campaigns table) reached the send path
    // and threw. Drop anything that isn't a usable string so it falls back to the built-in default
    // instead. Deliberately normalizing rather than rejecting: a throw here makes
    // getActiveCampaigns skip the row, which silently takes the whole campaign off the air —
    // a far worse outcome than one label reverting to its default.
    copy: {
      opening: copy.opening,
      opening_button: optionalString(copy.opening_button),
      follow_gate: optionalString(copy.follow_gate),
      follow_button: optionalString(copy.follow_button),
      follow_profile_button: optionalString(copy.follow_profile_button),
      follow_profile_url: optionalString(copy.follow_profile_url),
      email_ask: optionalString(copy.email_ask),
      delivery: copy.delivery,
      delivery_button: optionalString(copy.delivery_button),
      delivery_url: optionalString(copy.delivery_url),
      followup_message: optionalString(copy.followup_message),
      followup_button: optionalString(copy.followup_button),
    },
    ...(followup ? { followup } : {}),
    ...(recommendation ? { recommendation } : {}),
    ...(features ? { features } : {}),
  };
}

/** Keep a copy field only if it is a non-empty string; anything else falls back to the default. */
function optionalString(v: unknown): string | undefined {
  return isNonEmptyString(v) ? v : undefined;
}

/** Validate a full config payload (Section 7). */
export function validateConfig(input: unknown): AppConfig {
  if (typeof input !== "object" || input === null) {
    throw new ConfigError("config must be an object");
  }
  const cfg = input as Record<string, unknown>;
  if (!Array.isArray(cfg.campaigns) || cfg.campaigns.length === 0) {
    throw new ConfigError("config.campaigns must be a non-empty array");
  }
  const campaigns = cfg.campaigns.map((c, i) => validateCampaign(c, i));

  // Enforce unique campaign_ids.
  const ids = new Set<string>();
  for (const c of campaigns) {
    if (ids.has(c.campaign_id)) throw new ConfigError(`duplicate campaign_id: ${c.campaign_id}`);
    ids.add(c.campaign_id);
  }

  const mode = cfg.mode === "webhook" ? "webhook" : "polling";
  const interval =
    typeof cfg.poll_interval_seconds === "number" && cfg.poll_interval_seconds > 0
      ? cfg.poll_interval_seconds
      : 90;

  return { mode, poll_interval_seconds: interval, campaigns };
}
