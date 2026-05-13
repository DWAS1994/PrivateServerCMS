// /api/forum/categories — GET list w/ aggregated counts
import { prisma } from "@/lib/prisma";

export default async function handler(req, res) {
  const cats = await prisma.forumCategory.findMany({
    orderBy: { position: "asc" },
    include: {
      _count: { select: { threads: true } },
      threads: {
        orderBy: { updatedAt: "desc" },
        take: 1,
        include: { author: { select: { username: true } } },
      },
    },
  });

  // Sum posts per category
  const result = await Promise.all(
    cats.map(async (c) => {
      const postCount = await prisma.forumPost.count({
        where: { thread: { categoryId: c.id } },
      });
      return {
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description,
        position: c.position,
        threadCount: c._count.threads,
        postCount,
        latest: c.threads[0]
          ? {
              id: c.threads[0].id,
              title: c.threads[0].title,
              authorName: c.threads[0].author.username,
              updatedAt: c.threads[0].updatedAt,
            }
          : null,
      };
    })
  );

  res.json(result);
}
