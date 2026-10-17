// Shared types for chatmany.

/** Cloudflare bindings + vars available on the Worker environment. */
export interface Env {
  DB: D1Database;
  /** Static-asset binding serving the web UI from ./public. */
  ASSETS: Fetcher;

  // vars (wrangler.toml [vars])
  GRAPH_VERSION: string;
  MODE: "polling" | "webhook";
  POLL_INTERVAL_SECONDS: string;
  /** Webhook mode only: seconds between slow reconciliation polls that catch missed webhook
   *  deliveries. "off" or 0 disables them (pure push). Defaults to 900. */
  WEBHOOK_RECONCILE_SECONDS?: string;
  REDIRECT_URI: string;

  // secrets (wrangler secret put ...)
  APP_ID: string;
  APP_SECRET: string;
  OWNER_TOKEN: string;
  WEBHOOK_VERIFY_TOKEN?: string;
  /** Shared with Postiz (CHATMANY_SSO_SECRET there). When set, Postiz can sign its users in to
   *  the embedded UI without the owner token — see auth/session.ts. */
  POSTIZ_SSO_SECRET?: string;
  /** Postiz backend address (e.g. http://localhost:3100). With POSTIZ_SSO_SECRET set, Instagram
   *  is connected in Postiz and chatmany pulls the token from it — see auth/postiz.ts. */
  POSTIZ_URL?: string;
  /** Postiz web app address (e.g. http://localhost:4200): the only site allowed to frame the UI,
   *  and where the "Connect Instagram in Postiz" link points. */
  POSTIZ_APP_URL?: string;
  /** This Worker's public https address. Needed for tracked reward links (follow-ups); falls back
   *  to the origin of REDIRECT_URI once that is set to the real Worker URL. */
  PUBLIC_URL?: string;
}

/** Funnel state for one person in one campaign. */
export type State =
  | "NEW"
  | "AWAITING_TAP"
  | "AWAITING_FOLLOW"
  | "AWAITING_EMAIL"
  | "DELIVER"
  | "DONE";

/** Analytics event types (mirrors events.type). */
export type EventType =
  | "comment_matched"
  | "opening_sent"
  | "button_clicked"
  | "follow_confirmed"
  | "email_captured"
  | "delivered"
  | "link_clicked"
  | "followup_sent";

/** Follow-up for people who got the reward link and never opened it (see engine.sendDueFollowups). */
export interface FollowupConfig {
  enabled: boolean;
  /** Minutes after delivery; 5 to 1380 (23 h), inside Instagram's 24-hour messaging window. */
  delay_minutes: number;
  /** The follow-up message; `{reward}` is replaced by the (tracked) link. */
  text: string;
}

/** Recommendation for people who completed the funnel (see engine.sendDueRecommendations). */
export interface RecommendationConfig {
  enabled: boolean;
  /** Minutes after initial button click; 5 to 1380 (23 h), inside Instagram's 24-hour messaging window. */
  delay_minutes: number;
  /** The recommendation message; customizable text to suggest another product/service. */
  message: string;
  /** Button label for the recommendation (customizable, up to 30 chars). */
  button_label: string;
  /** Optional link or URL for the recommendation. */
  link?: string;
}

export interface RewardConfig {
  type: "link" | "code" | "text";
  value: string;
}

export interface PublicReplyConfig {
  enabled: boolean;
  texts: string[];
}

/** Individual function toggles for modular automation (12 independent features). */
export interface FeatureFlags {
  /** 1. Monitor comments for keywords */
  commentMonitoring: boolean;
  /** 2. Send public reply with @ mention */
  publicReply: boolean;
  /** 3. Send initial private message */
  initialDM: boolean;
  /** 4. Show initial button (opening gate) */
  initialButton: boolean;
  /** 5. Ask to follow the profile */
  followGate: boolean;
  /** 6. Show "Already following" button confirmation */
  followButton: boolean;
  /** 7. Verify follower status via API */
  followVerification: boolean;
  /** 8. Repeat follow message if not confirmed */
  followRepeat: boolean;
  /** 9. Auto-deliver final link after conditions */
  autoDelivery: boolean;
  /** 10. Track clicks on reward links */
  linkTracking: boolean;
  /** 11. Send reminder DM if link unopened (24h window) */
  reminderMessage: boolean;
  /** 12. Request email via quick-reply */
  emailCollection: boolean;
}

export interface CampaignCopy {
  opening: string;
  opening_button?: string;
  follow_gate?: string;
  follow_button?: string;
  /** Button label to visit profile (defaults to "Visit profile") */
  follow_profile_button?: string;
  /** URL for the visit profile button (Instagram profile link) */
  follow_profile_url?: string;
  email_ask?: string;
  delivery: string;
  /** Delivery button label (customizable) */
  delivery_button?: string;
  /** URL for material delivery link */
  delivery_url?: string;
  /** Follow-up/reminder message (customizable) */
  followup_message?: string;
  /** Follow-up button label (customizable) */
  followup_button?: string;
}

/** `media_id` value meaning "any post or reel on the account" (a campaign set up for one specific
 *  post always takes precedence over it for that post's comments). */
export const ANY_MEDIA = "*";

/** A single campaign (Section 7). Validated on load. */
export interface Campaign {
  campaign_id: string;
  /** Human-friendly automation name shown in the builder/list (optional). */
  name?: string;
  /** Folder it is filed under in the automations list (optional, display only). */
  folder?: string;
  /** A media id, or ANY_MEDIA. */
  media_id: string;
  keywords: string[];
  /** Trigger on every comment (still subject to `exclude`); `keywords` may then be empty. */
  match_any?: boolean;
  exclude?: string[];
  public_reply?: PublicReplyConfig;
  /** @deprecated Instagram's API cannot like comments. Accepted for backwards compatibility; ignored. */
  like_comment?: boolean;
  check_follow?: boolean;
  /** @deprecated No API can verify a follow; the follower-count heuristic this drove was noise.
   *  Accepted for backwards compatibility so older saved campaigns keep loading; ignored. */
  verify_follow_count?: boolean;
  ask_email?: boolean;
  reward: RewardConfig;
  copy: CampaignCopy;
  followup?: FollowupConfig;
  /** Recommendation (upsell) DM for people who completed the funnel. */
  recommendation?: RecommendationConfig;
  /** Modular feature toggles (12 independent functions). All default to true for backwards compatibility. */
  features?: Partial<FeatureFlags>;
}

/** Top-level config file / import payload (Section 7). */
export interface AppConfig {
  mode?: "polling" | "webhook";
  poll_interval_seconds?: number;
  campaigns: Campaign[];
}

/** Normalized event the engine consumes, regardless of transport (poll or webhook). */
export interface NormalizedComment {
  kind: "comment";
  comment_id: string;
  igsid: string;
  username?: string;
  text: string;
  media_id: string;
  timestamp: number;
}

export interface NormalizedMessage {
  kind: "message";
  igsid: string;
  text?: string;
  /** Postback / quick-reply payload if the transport exposes it (webhooks do; polling may not). */
  payload?: string;
  /** Email captured from a user_email quick-reply chip, if present. */
  email?: string;
  timestamp: number;
}

export type NormalizedEvent = NormalizedComment | NormalizedMessage;

/** Helper: check if a feature is enabled (defaults to true for backwards compatibility). */
export function isFeatureEnabled(features: Partial<FeatureFlags> | undefined, key: keyof FeatureFlags): boolean {
  return features?.[key] !== false; // defaults to true if not explicitly set to false
}

/** Stored auth row. */
export interface AuthRow {
  access_token: string;
  ig_user_id: string | null;
  username: string | null;
  account_type: string | null;
  profile_picture_url: string | null;
  expires_at: number;
  refreshed_at: number | null;
}
