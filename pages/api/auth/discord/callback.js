// GET /api/auth/discord/callback — Discord redirects here after the user
// approves (or denies) the OAuth prompt.
//
// 1. Verify the `state` matches what we stashed in the session (CSRF guard)
// 2. Exchange `?code=...` for an access token
// 3. Fetch the Discord profile
// 4. Find or create a matching User row
//    - If a user is already logged in: link Discord to that user
//    - Else if a User has this discordId: log them in
//    - Else if a User has this email: link Discord to that user, log in
//    - Else create a new account
// 5. Set session.userId and redirect home (or to the stashed `next`)
import { prisma } from "@/lib/prisma";
import { getSession, hashPassword } from "@/lib/auth";
import { exchangeCode, fetchProfile, isConfigured } from "@/lib/discord";
import crypto from "crypto";

// Discord usernames may contain characters that don't match our local
// username regex (a-z0-9_). Strip them, then ensure uniqueness.
function sanitizeUsername(name) {
  const cleaned = String(name || "").replace(/[^a-zA-Z0-9_]/g, "").slice(0, 18);
  return cleaned.length >= 3 ? cleaned : `user_${Math.floor(Math.random() * 1e6)}`;
}

async function uniqueUsername(base) {
  let candidate = base;
  let i = 0;
  while (await prisma.user.findUnique({ where: { username: candidate } })) {
    i++;
    candidate = `${base}_${i}`;
    if (i > 50) {
      // Give up trying derivatives, just slap a random suffix on it
      candidate = `${base}_${crypto.randomBytes(2).toString("hex")}`;
      break;
    }
  }
  return candidate;
}

export default async function handler(req, res) {
  if (!isConfigured()) {
    return res.redirect(303, "/login?error=discord_not_configured");
  }

  const { code, state, error: oauthError } = req.query;

  if (oauthError) {
    // User clicked "Cancel" on Discord's approval screen
    return res.redirect(303, "/login?error=discord_cancelled");
  }
  if (!code || !state) {
    return res.redirect(303, "/login?error=discord_missing_params");
  }

  // CSRF check
  const session = await getSession(req, res);
  if (state !== session.discordOauthState) {
    return res.redirect(303, "/login?error=discord_state_mismatch");
  }
  const nextDest = session.discordOauthNext || "/account";
  // Clean up the temporary state fields
  delete session.discordOauthState;
  delete session.discordOauthNext;
  await session.save();

  // Exchange code for token + fetch profile
  let profile;
  try {
    const tokens = await exchangeCode(code);
    profile = await fetchProfile(tokens.access_token);
  } catch (e) {
    console.error("Discord OAuth error:", e);
    return res.redirect(303, "/login?error=discord_token_exchange");
  }

  const discordId = String(profile.id);
  const discordEmail = profile.email || null;
  const discordUsername = profile.username || `user_${discordId.slice(-6)}`;

  // ── Decide who this user is ──
  let user = null;

  // (a) Already logged in? Link this Discord account.
  if (session.userId) {
    const me = await prisma.user.findUnique({ where: { id: session.userId } });
    if (me) {
      // Make sure no other account already claims this discordId
      const conflict = await prisma.user.findUnique({ where: { discordId } });
      if (conflict && conflict.id !== me.id) {
        return res.redirect(303, "/account?error=discord_already_linked");
      }
      user = await prisma.user.update({
        where: { id: me.id },
        data: { discordId, lastLogin: new Date() },
      });
    }
  }

  // (b) Existing account with this Discord ID? Log them in.
  if (!user) {
    user = await prisma.user.findUnique({ where: { discordId } });
    if (user) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() },
      });
    }
  }

  // (c) Existing account with this email? Link Discord, then log in.
  if (!user && discordEmail) {
    const byEmail = await prisma.user.findUnique({ where: { email: discordEmail } });
    if (byEmail) {
      user = await prisma.user.update({
        where: { id: byEmail.id },
        data: { discordId, lastLogin: new Date() },
      });
    }
  }

  // (d) Create a brand-new account
  if (!user) {
    // Check if registration is even open
    const config = await prisma.serverConfig.findUnique({ where: { id: 1 } });
    if (config && !config.registrationOpen) {
      return res.redirect(303, "/login?error=registration_closed");
    }

    const baseName = sanitizeUsername(discordUsername);
    const username = await uniqueUsername(baseName);

    // Generate a random unguessable password — Discord-only users will use
    // the Discord button to log in, but we still need *something* in
    // passwordHash (it's NOT NULL).
    const randomPassword = crypto.randomBytes(32).toString("hex");
    const passwordHash = await hashPassword(randomPassword);

    // Email might be missing if the user denied the email scope. Use a
    // unique placeholder so we don't violate the UNIQUE constraint.
    const email = discordEmail || `discord_${discordId}@no-email.local`;

    // If email is already taken (very unlikely but possible), bail to the
    // existing-account path with a friendly message
    const emailClash = await prisma.user.findUnique({ where: { email } });
    if (emailClash) {
      return res.redirect(303, "/login?error=discord_email_clash");
    }

    user = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash,
        discordId,
        role: "player",
        lastLogin: new Date(),
      },
    });
  }

  // Final check — banned users get the door
  if (user.banned) {
    return res.redirect(303, "/login?error=banned");
  }

  // Set the session and redirect
  session.userId = user.id;
  await session.save();

  res.redirect(303, nextDest);
}
