// /api/chat/messages — GET recent messages, POST a new one
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export default async function handler(req, res) {
  const channel = String(req.query.channel || req.body?.channel || "general");

  if (req.method === "GET") {
    // Public read — anyone (logged-in or not) can see chat
    const messages = await prisma.chatMessage.findMany({
      where: { channel, deleted: false },
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

    // Banned users can't post at all (login itself should already block them,
    // but defense-in-depth)
    if (user.banned) {
      return res.status(403).json({ error: "Your account is banned." });
    }
    // Muted users can't post until their mute expires
    if (user.mutedUntil && new Date(user.mutedUntil) > new Date()) {
      const minutesLeft = Math.ceil(
        (new Date(user.mutedUntil).getTime() - Date.now()) / 60_000
      );
      return res.status(403).json({
        error: `You're muted${user.muteReason ? ` (${user.muteReason})` : ""}. ${minutesLeft} min remaining.`,
      });
    }

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
