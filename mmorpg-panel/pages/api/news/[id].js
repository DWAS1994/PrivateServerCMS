// /api/news/[id] — PUT update, DELETE remove (admin only)
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export default async function handler(req, res) {
  const id = parseInt(req.query.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Bad id" });

  if (req.method === "PUT") {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const { title, body, category, pinned } = req.body || {};
    const post = await prisma.newsPost.update({
      where: { id },
      data: {
        ...(title !== undefined && { title: String(title).slice(0, 200) }),
        ...(body !== undefined && { body: String(body) }),
        ...(category !== undefined && { category }),
        ...(pinned !== undefined && { pinned: !!pinned }),
      },
    });
    return res.json(post);
  }

  if (req.method === "DELETE") {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    await prisma.newsPost.delete({ where: { id } });
    return res.json({ ok: true });
  }

  res.status(405).json({ error: "Method not allowed" });
}
