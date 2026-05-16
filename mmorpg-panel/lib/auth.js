// Authentication: iron-session cookie-based sessions + bcrypt password hashing.
// All session data is stored encrypted client-side, so no Session table.
import { getIronSession } from "iron-session";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

export const sessionOptions = {
  cookieName: "mmorpg_panel_session",
  password:
    process.env.SESSION_SECRET ||
    "dev-secret-please-change-in-production-32chars",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  },
};

export async function getSession(req, res) {
  return getIronSession(req, res, sessionOptions);
}

// Returns the current user (full DB record) or null
export async function getCurrentUser(req, res) {
  const session = await getSession(req, res);
  if (!session.userId) return null;
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || user.banned) return null;
  return user;
}

// API route guard — call at top of handler
export async function requireUser(req, res) {
  const user = await getCurrentUser(req, res);
  if (!user) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }
  return user;
}

export async function requireAdmin(req, res) {
  const user = await requireUser(req, res);
  if (!user) return null;
  if (user.role !== "admin" && user.role !== "gm") {
    res.status(403).json({ error: "Admin access required" });
    return null;
  }
  return user;
}

// Password helpers
export async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}
export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

// Strip sensitive fields before sending user data to clients
// Strip sensitive fields and serialize Date objects so the result is safe to
// pass through getServerSideProps to a client component.
export function publicUser(u) {
  if (!u) return null;
  const { passwordHash, banReason, ...rest } = u;
  return {
    ...rest,
    createdAt: rest.createdAt instanceof Date ? rest.createdAt.toISOString() : rest.createdAt,
    lastLogin: rest.lastLogin instanceof Date ? rest.lastLogin.toISOString() : rest.lastLogin,
    vipUntil: rest.vipUntil instanceof Date ? rest.vipUntil.toISOString() : rest.vipUntil,
  };
}
