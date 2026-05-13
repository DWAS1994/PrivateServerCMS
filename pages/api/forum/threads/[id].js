// /api/forum/threads/[id] — GET full thread w/ posts; POST add reply
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { notifyForumReply } from "@/lib/notifications";

export default async function handler(req, res) {
  const id = parseInt(req.query.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Bad id" });

  if (req.method === "GET") {
    // Bump views (best-effort, swallow errors)
    prisma.forumThread.update({ where: { id }, data: { views: { increment: 1 } } })
      .catch(() => {});

    const thread = await prisma.forumThread.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, username: true, role: true } },
        category: { select: { name: true, slug: true } },
        posts: {
          orderBy: { createdAt: "asc" },
          include: { author: { select: { id: true, username: true, role: true, createdAt: true } } },
        },
      },
    });
    if (!thread) return res.status(404).json({ error: "Thread not found" });
    return res.json(thread);
  }

  if (req.method === "POST") {
    const user = await requireUser(req, res);
    if (!user) return;

    const thread = await prisma.forumThread.findUnique({ where: { id } });
    if (!thread) return res.status(404).json({ error: "Thread not found" });
    if (thread.locked && user.role !== "admin" && user.role !== "gm") {
      return res.status(403).json({ error: "Thread is locked." });
    }

    const { body } = req.body || {};
    if (!body || String(body).trim().length < 2) {
      return res.status(400).json({ error: "Reply too short." });
    }

    const post = await prisma.forumPost.create({
      data: { threadId: id, authorId: user.id, body: String(body) },
      include: { author: { select: { id: true, username: true, role: true } } },
    });
    // Bump thread updatedAt so it sorts to the top
    await prisma.forumThread.update({ where: { id }, data: { updatedAt: new Date() } });

    // Notify the OP that someone replied (no-op if self-reply)
    await notifyForumReply({
      threadId: id,
      threadTitle: thread.title,
      authorId: thread.authorId,
      replierName: user.username,
      replierId: user.id,
    });

    return res.status(201).json(post);
  }

  res.status(405).json({ error: "Method not allowed" });
}
