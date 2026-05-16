// /api/notifications — list current user's notifications + global ones
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export default async function handler(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;

  if (req.method === "GET") {
    // Personal + global, last 30 days, max 50
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const notifications = await prisma.notification.findMany({
      where: {
        OR: [{ userId: user.id }, { userId: null }],
        createdAt: { gte: since },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // Unread count: only personal unread notifications + recent global (< 7d)
    const unreadCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const unreadCount = notifications.filter((n) =>
      n.userId === user.id ? !n.read : n.createdAt >= unreadCutoff && !n.read
    ).length;

    // Also count unread DMs separately so the bell can show a combined badge
    const unreadDMs = await prisma.directMessage.count({
      where: { recipientId: user.id, read: false },
    });

    return res.json({
      notifications: notifications.map((n) => ({
        ...n,
        global: n.userId === null,
        createdAt: n.createdAt.toISOString(),
      })),
      unreadCount,
      unreadDMs,
    });
  }

  if (req.method === "POST") {
    // Mark all current user's personal notifications as read
    await prisma.notification.updateMany({
      where: { userId: user.id, read: false },
      data: { read: true },
    });
    return res.json({ ok: true });
  }

  res.status(405).json({ error: "Method not allowed" });
}
