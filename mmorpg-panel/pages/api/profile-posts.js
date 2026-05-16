// /api/profile-posts — GET ?username=foo, POST { profileUsername, body }
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { notifyWallPost } from "@/lib/notifications";

export default async function handler(req, res) {
  if (req.method === "GET") {
    const username = req.query.username;
    if (!username) return res.status(400).json({ error: "username required" });
    const profileUser = await prisma.user.findUnique({
      where: { username: String(username) },
    });
    if (!profileUser) return res.status(404).json({ error: "User not found" });

    const posts = await prisma.profilePost.findMany({
      where: { profileUserId: profileUser.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { author: { select: { id: true, username: true, role: true } } },
    });
    return res.json({
      posts: posts.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() })),
    });
  }

  if (req.method === "POST") {
    const user = await requireUser(req, res);
    if (!user) return;

    const { profileUsername, body } = req.body || {};
    const text = String(body || "").trim();
    if (!profileUsername || !text) {
      return res.status(400).json({ error: "profileUsername and body required" });
    }
    if (text.length > 2000) return res.status(400).json({ error: "Post too long (max 2000)" });

    const profileUser = await prisma.user.findUnique({
      where: { username: String(profileUsername) },
    });
    if (!profileUser) return res.status(404).json({ error: "User not found" });

    const post = await prisma.profilePost.create({
      data: { authorId: user.id, profileUserId: profileUser.id, body: text },
      include: { author: { select: { id: true, username: true, role: true } } },
    });
    await notifyWallPost({
      profileUserId: profileUser.id,
      authorId: user.id,
      authorName: user.username,
    });
    return res.status(201).json({ ...post, createdAt: post.createdAt.toISOString() });
  }

  res.status(405).json({ error: "Method not allowed" });
}
