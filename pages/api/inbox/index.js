// /api/inbox — list current user's conversations (grouped by other party)
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export default async function handler(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Pull recent messages where the user is sender or recipient,
  // then collapse to one row per other-party with the latest message.
  const messages = await prisma.directMessage.findMany({
    where: {
      OR: [{ senderId: user.id }, { recipientId: user.id }],
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      sender: { select: { id: true, username: true, role: true } },
      recipient: { select: { id: true, username: true, role: true } },
    },
  });

  const byParty = new Map();
  for (const m of messages) {
    const other = m.senderId === user.id ? m.recipient : m.sender;
    if (!byParty.has(other.id)) {
      byParty.set(other.id, {
        otherUser: other,
        lastMessage: {
          id: m.id,
          body: m.body,
          createdAt: m.createdAt.toISOString(),
          fromMe: m.senderId === user.id,
        },
        unreadCount: 0,
      });
    }
  }
  // Count unread messages per conversation
  const unread = await prisma.directMessage.groupBy({
    by: ["senderId"],
    where: { recipientId: user.id, read: false },
    _count: true,
  });
  for (const row of unread) {
    if (byParty.has(row.senderId)) {
      byParty.get(row.senderId).unreadCount = row._count;
    }
  }

  res.json({ conversations: Array.from(byParty.values()) });
}
