// /api/admin/notifications — POST send global notification (admin only)
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { notifyEveryone } from "@/lib/notifications";

export default async function handler(req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  if (req.method === "GET") {
    const list = await prisma.notification.findMany({
      where: { userId: null },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return res.json({
      notifications: list.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() })),
    });
  }

  if (req.method === "POST") {
    const { type, title, body, link } = req.body || {};
    if (!title) return res.status(400).json({ error: "title required" });
    const n = await notifyEveryone({
      type: type || "system",
      title: String(title).slice(0, 200),
      body: body || null,
      link: link || null,
    });
    return res.status(201).json({ ...n, createdAt: n.createdAt.toISOString() });
  }

  res.status(405).json({ error: "Method not allowed" });
}
