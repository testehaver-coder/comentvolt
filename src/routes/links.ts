// Tracked reward links. A delivery DM for a campaign with a follow-up carries /r/<token> instead of
// the reward link itself; opening it records the click (once) and redirects to the real link, so
// the follow-up only goes to people who never opened it. Public by design: the person tapping the
// link in Instagram has no credentials, and the random token only reveals where it redirects.

import { getTrackedLink, logEvent, markLinkClicked } from "../db";
import type { Env } from "../types";
import { html } from "./http";

export async function handleTrackedLink(env: Env, token: string): Promise<Response> {
  const link = await getTrackedLink(env.DB, token);
  if (!link) return html("<h1>Link not found</h1>", 404);
  if (await markLinkClicked(env.DB, token)) {
    await logEvent(env.DB, link.campaign_id, "link_clicked", link.igsid);
  }
  return new Response(null, { status: 302, headers: { location: link.url, "referrer-policy": "no-referrer" } });
}
