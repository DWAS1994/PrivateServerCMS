// Discord OAuth helper.
// Docs: https://discord.com/developers/docs/topics/oauth2
//
// Set in .env:
//   DISCORD_CLIENT_ID=...
//   DISCORD_CLIENT_SECRET=...
//   DISCORD_REDIRECT_URI=http://localhost:3000/api/auth/discord/callback
//     (must match what's configured in the Discord Developer Portal)

const SCOPES = ["identify", "email"];

export function isConfigured() {
  // Hard kill switch — set DISCORD_DISABLED=1 to force-hide Discord login
  // even if client credentials are present in the environment.
  if (process.env.DISCORD_DISABLED === "1") return false;
  return !!(
    process.env.DISCORD_CLIENT_ID &&
    process.env.DISCORD_CLIENT_SECRET &&
    process.env.DISCORD_REDIRECT_URI
  );
}

/** Build the Discord OAuth authorize URL to redirect the user to. */
export function buildAuthorizeUrl(state) {
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    redirect_uri: process.env.DISCORD_REDIRECT_URI,
    response_type: "code",
    scope: SCOPES.join(" "),
    state,
    prompt: "consent",
  });
  return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
}

/** Exchange the ?code=… on the callback for an access token. */
export async function exchangeCode(code) {
  const body = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    client_secret: process.env.DISCORD_CLIENT_SECRET,
    grant_type: "authorization_code",
    code,
    redirect_uri: process.env.DISCORD_REDIRECT_URI,
  });
  const res = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord token exchange failed: ${res.status} ${text}`);
  }
  return res.json(); // { access_token, token_type, expires_in, refresh_token, scope }
}

/** Fetch the authenticated user's Discord profile. */
export async function fetchProfile(accessToken) {
  const res = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord profile fetch failed: ${res.status} ${text}`);
  }
  return res.json(); // { id, username, discriminator, email, verified, ... }
}
