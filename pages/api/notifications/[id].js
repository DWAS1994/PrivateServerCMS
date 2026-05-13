// /api/notifications/[id] — mark a single notification read (or delete)
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export default async function handler(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;

  const id = parseInt(req.query.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Bad id" });

  const n = await prisma.notification.findUnique({ where: { id } });
  if (!n) return res.status(404).json({ error: "Not found" });
  // Only the recipient (or anyone for global) can mark it read
  if (n.userId !== null && n.userId !== user.id) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method === "POST") {
    // Globals: only admins can dismiss for everyone; players just ignore them
    if (n.userId === null && user.role !== "admin") {
      return res.status(403).json({ error: "Only admins can dismiss global notifications" });
    }
    await prisma.notification.update({ where: { id }, data: { read: true } });
    return res.json({ ok: true });
  }

  if (req.method === "DELETE") {
    if (n.userId === null && user.role !== "admin") {
      return res.status(403).json({ error: "Only admins can delete global notifications" });
    }
    await prisma.notification.delete({ where: { id } });
    return res.json({ ok: true });
  }

  res.status(405).json({ error: "Method not allowed" });
}
