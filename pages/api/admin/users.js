// /api/admin/users — GET list, PUT [id] update
import { prisma } from "@/lib/prisma";
import { requireAdmin, publicUser } from "@/lib/auth";

export default async function handler(req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  if (req.method === "GET") {
    const q = (req.query.q || "").trim();
    const where = q
      ? { OR: [{ username: { contains: q } }, { email: { contains: q } }] }
      : {};
    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return res.json(users.map(publicUser));
  }

  if (req.method === "PUT") {
    const { id, role, banned, banReason, silver } = req.body || {};
    if (!id) return res.status(400).json({ error: "id required" });

    // Don't let admins demote themselves
    if (id === admin.id && role && role !== admin.role) {
      return res.status(400).json({ error: "Can't change your own role." });
    }

    const data = {};
    if (role && ["player", "gm", "admin"].includes(role)) data.role = role;
    if (banned !== undefined) data.banned = !!banned;
    if (banReason !== undefined) data.banReason = banReason || null;
    if (silver !== undefined) data.silver = Math.max(0, parseInt(silver, 10) || 0);

    const updated = await prisma.user.update({ where: { id: parseInt(id, 10) }, data });
    return res.json(publicUser(updated));
  }

  res.status(405).json({ error: "Method not allowed" });
}
