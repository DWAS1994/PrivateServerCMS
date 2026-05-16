// /api/forum/threads — GET (?category=slug), POST create
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export default async function handler(req, res) {
  if (req.method === "GET") {
    const slug = req.query.category;
    const where = slug
      ? { category: { slug: String(slug) } }
      : {};
    const threads = await prisma.forumThread.findMany({
      where,
      orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
      take: 50,
      include: {
        author: { select: { id: true, username: true, role: true } },
        category: { select: { name: true, slug: true } },
        _count: { select: { posts: true } },
      },
    });
    return res.json(threads);
  }

  if (req.method === "POST") {
    const user = await requireUser(req, res);
    if (!user) return;

    const { categorySlug, title, body } = req.body || {};
    if (!categorySlug || !title || !body) {
      return res.status(400).json({ error: "Category, title and body are required." });
    }
    const category = await prisma.forumCategory.findUnique({
      where: { slug: String(categorySlug) },
    });
    if (!category) return res.status(404).json({ error: "Category not found." });

    const thread = await prisma.forumThread.create({
      data: {
        title: String(title).slice(0, 200),
        authorId: user.id,
        categoryId: category.id,
        posts: { create: { authorId: user.id, body: String(body) } },
      },
      include: { category: true },
    });
    return res.status(201).json(thread);
  }

  res.status(405).json({ error: "Method not allowed" });
}
