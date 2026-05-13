// POST /api/auth/login
import { prisma } from "@/lib/prisma";
import { verifyPassword, getSession, publicUser } from "@/lib/auth";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required." });
  }

  // Look up by username OR email — players use whichever they remember
  const user = await prisma.user.findFirst({
    where: { OR: [{ username }, { email: username }] },
  });

  if (!user) {
    return res.status(401).json({ error: "Invalid credentials." });
  }
  if (user.banned) {
    return res.status(403).json({
      error: `Account banned${user.banReason ? `: ${user.banReason}` : "."}`,
    });
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: "Invalid credentials." });
  }

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLogin: new Date() },
  });

  const session = await getSession(req, res);
  session.userId = user.id;
  await session.save();

  return res.json({ user: publicUser(user) });
}
