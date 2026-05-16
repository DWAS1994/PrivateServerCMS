// /api/inbox/conversation — messages with a specific user (?with=USERID)
//   GET — fetch messages, marks them read
//   POST — send a new message
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { notifyNewDM } from "@/lib/notifications";

export default async function handler(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;

  const otherIdRaw = req.method === "POST" ? req.body?.recipientId : req.query.with;
  const otherId = parseInt(otherIdRaw, 10);
  if (Number.isNaN(otherId)) return res.status(400).json({ error: "Bad recipient id" });
  if (otherId === user.id) return res.status(400).json({ error: "Can't message yourself" });

  const other = await prisma.user.findUnique({ where: { id: otherId } });
  if (!other) return res.status(404).json({ error: "User not found" });

  if (req.method === "GET") {
    const msgs = await prisma.directMessage.findMany({
      where: {
        OR: [
          { senderId: user.id, recipientId: otherId },
          { senderId: otherId, recipientId: user.id },
        ],
      },
      orderBy: { createdAt: "asc" },
      take: 200,
    });
    // Mark received messages from this user as read
    await prisma.directMessage.updateMany({
      where: { senderId: otherId, recipientId: user.id, read: false },
      data: { read: true },
    });
    return res.json({
      otherUser: { id: other.id, username: other.username, role: other.role },
      messages: msgs.map((m) => ({
        ...m,
        fromMe: m.senderId === user.id,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  }

  if (req.method === "POST") {
    const body = String(req.body?.body || "").trim();
    if (!body) return res.status(400).json({ error: "Message body required" });
    if (body.length > 5000) return res.status(400).json({ error: "Message too long (max 5000)" });

    const dm = await prisma.directMessage.create({
      data: { senderId: user.id, recipientId: otherId, body },
    });
    await notifyNewDM({
      senderId: user.id,
      senderName: user.username,
      recipientId: otherId,
      dmId: dm.id,
    });
    return res.status(201).json({
      ...dm,
      fromMe: true,
      createdAt: dm.createdAt.toISOString(),
    });
  }

  res.status(405).json({ error: "Method not allowed" });
}
