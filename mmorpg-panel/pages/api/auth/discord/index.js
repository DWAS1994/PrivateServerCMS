// GET /api/auth/discord — start the Discord OAuth flow.
// Generates a random state token, stashes it in the session cookie, then
// 302-redirects to Discord's authorize page.
import crypto from "crypto";
import { getSession } from "@/lib/auth";
import { buildAuthorizeUrl, isConfigured } from "@/lib/discord";

export default async function handler(req, res) {
  if (!isConfigured()) {
    // Silently send them back to login. No error message, no scary 503.
    return res.redirect(302, "/login");
  }

  // CSRF protection: random state we'll verify on the callback. Also stash
  // the `next` query so we can redirect back where the user came from.
  const session = await getSession(req, res);
  const state = crypto.randomBytes(24).toString("hex");
  session.discordOauthState = state;
  session.discordOauthNext = typeof req.query.next === "string" ? req.query.next : "/account";
  await session.save();

  res.redirect(302, buildAuthorizeUrl(state));
}
