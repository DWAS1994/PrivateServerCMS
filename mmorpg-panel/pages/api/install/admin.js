// POST /api/install/admin — create the first admin user during install.
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { isInstalled } from "@/lib/license";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (await isInstalled()) {
    return res.status(403).json({ error: "Install already completed." });
  }

  const { username, email, password } = req.body || {};
  if (!username || !email || !password) {
    return res.status(400).json({ error: "All fields are required." });
  }
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    return res.status(400).json({ error: "Username must be 3–20 letters/numbers/underscores." });
  }
  if (!email.includes("@")) {
    return res.status(400).json({ error: "Invalid email." });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }

  // Refuse if any admin already exists — prevents privilege escalation if
  // someone somehow hits this after install (the isInstalled guard above
  // should already catch that, but be defensive).
  const existingAdmin = await prisma.user.findFirst({ where: { role: "admin" } });
  if (existingAdmin) {
    return res.status(409).json({ error: "An admin already exists." });
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.create({
    data: { username, email, passwordHash, role: "admin" },
  });

  return res.json({ ok: true });
}
