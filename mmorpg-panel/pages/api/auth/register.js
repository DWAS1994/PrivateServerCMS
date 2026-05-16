// POST /api/auth/register
import { prisma } from "@/lib/prisma";
import { hashPassword, getSession, publicUser } from "@/lib/auth";
import * as gameDb from "@/lib/gameDb";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { username, email, password } = req.body || {};

  // Validation
  if (!username || !email || !password) {
    return res.status(400).json({ error: "All fields are required." });
  }
  if (username.length < 3 || username.length > 20) {
    return res.status(400).json({ error: "Username must be 3–20 characters." });
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return res.status(400).json({ error: "Username can only contain letters, numbers, and underscores." });
  }
  if (!email.includes("@") || email.length > 100) {
    return res.status(400).json({ error: "Invalid email." });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters." });
  }

  // Check if registration is open
  const config = await prisma.serverConfig.findUnique({ where: { id: 1 } });
  if (config && !config.registrationOpen) {
    return res.status(403).json({ error: "Registration is currently closed." });
  }

  // Uniqueness checks against the panel DB
  const existing = await prisma.user.findFirst({
    where: { OR: [{ username }, { email }] },
  });
  if (existing) {
    return res.status(409).json({
      error: existing.username === username
        ? "Username already taken."
        : "Email already registered.",
    });
  }

  // ── Game DB integration ──
  // If the game DB is connected, make sure the username isn't taken there
  // either, and provision the in-game account so the player can log in
  // immediately with the same credentials.
  const gameDbEnabled = await gameDb.isEnabled();
  if (gameDbEnabled) {
    try {
      const taken = await gameDb.gameAccountExists(username);
      if (taken) {
        return res.status(409).json({
          error: "Username already taken in the game database.",
        });
      }
    } catch (e) {
      console.error("Game DB precheck failed:", e);
      return res.status(503).json({
        error:
          "Game database is unreachable. Registration is temporarily unavailable — please try again shortly.",
      });
    }
  }

  // Create user in the panel DB
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      username,
      email,
      passwordHash,
      role: "player",
      lastLogin: new Date(),
    },
  });

  // Create the matching in-game account. We pass the raw password since most
  // silkroad emulators store/verify the password themselves; edit
  // lib/gameDb.js → createGameAccount if your emulator hashes differently.
  if (gameDbEnabled) {
    try {
      await gameDb.createGameAccount({ username, password, email });
    } catch (e) {
      console.error("Game DB account creation failed:", e);
      // Roll back the panel user so we don't end up with a half-registered state
      await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
      return res.status(500).json({
        error:
          "Couldn't create your in-game account. Please contact staff with this error: " +
          e.message,
      });
    }
  }

  // Auto-login
  const session = await getSession(req, res);
  session.userId = user.id;
  await session.save();

  return res.status(201).json({ user: publicUser(user) });
}
