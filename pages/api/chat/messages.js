// /api/chat/messages — GET recent messages, POST a new one
import { prisma } from "@/lib/prisma";
import { requireUser, getCurrentUser } from "@/lib/auth";

export default async function handler(req, res) {
  const channel = String(req.query.channel || req.body?.channel || "general");

  if (req.method === "GET") {
    // Public read — anyone (logged-in or not) can see chat
    const messages = await prisma.chatMessage.findMany({
      where: { channel },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        author: { select: { id: true, username: true, role: true } },
      },
    });
    // Reverse so oldest is first
    return res.json({
      channel,
      messages: messages.reverse().map((m) => ({
        ...m,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  }

  if (req.method === "POST") {
    const user = await requireUser(req, res);
    if (!user) return;

    const body = String(req.body?.body || "").trim();
    if (!body) return res.status(400).json({ error: "Message body required" });
    if (body.length > 1000) return res.status(400).json({ error: "Too long (max 1000)" });

    const m = await prisma.chatMessage.create({
      data: { authorId: user.id, channel, body },
      include: { author: { select: { id: true, username: true, role: true } } },
    });
    return res.status(201).json({ ...m, createdAt: m.createdAt.toISOString() });
  }

  res.status(405).json({ error: "Method not allowed" });
}
