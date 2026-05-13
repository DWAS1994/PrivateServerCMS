// /api/news — GET list (public), POST create (admin)
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export default async function handler(req, res) {
  if (req.method === "GET") {
    const posts = await prisma.newsPost.findMany({
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      take: 50,
    });
    return res.json(posts);
  }

  if (req.method === "POST") {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const { title, body, category, pinned } = req.body || {};
    if (!title || !body) {
      return res.status(400).json({ error: "Title and body required." });
    }
    const post = await prisma.newsPost.create({
      data: {
        title: String(title).slice(0, 200),
        body: String(body),
        author: admin.username,
        category: category || "announcement",
        pinned: !!pinned,
      },
    });
    return res.status(201).json(post);
  }

  res.status(405).json({ error: "Method not allowed" });
}
