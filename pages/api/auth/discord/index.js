// GET /api/auth/discord — start the Discord OAuth flow.
// Generates a random state token, stashes it in the session cookie, then
// 302-redirects to Discord's authorize page.
import crypto from "crypto";
import { getSession } from "@/lib/auth";
import { buildAuthorizeUrl, isConfigured } from "@/lib/discord";

export default async function handler(req, res) {
  if (!isConfigured()) {
    return res.status(503).send(
      "Discord login is not configured. Set DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, " +
        "and DISCORD_REDIRECT_URI in .env, then restart the server."
    );
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
