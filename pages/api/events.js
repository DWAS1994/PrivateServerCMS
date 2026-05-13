// /api/events — GET upcoming + past, POST create (admin)
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export default async function handler(req, res) {
  if (req.method === "GET") {
    const upcoming = await prisma.gameEvent.findMany({
      where: {
        OR: [
          { startsAt: { gte: new Date() } },
          { endsAt: { gte: new Date() } },
        ],
      },
      orderBy: { startsAt: "asc" },
    });
    return res.json(upcoming);
  }

  if (req.method === "POST") {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const { title, description, startsAt, endsAt, location, rewards } = req.body || {};
    if (!title || !description || !startsAt) {
      return res.status(400).json({ error: "Title, description, and start time required." });
    }
    const ev = await prisma.gameEvent.create({
      data: {
        title: String(title).slice(0, 200),
        description: String(description),
        startsAt: new Date(startsAt),
        endsAt: endsAt ? new Date(endsAt) : null,
        location: location || null,
        rewards: rewards || null,
      },
    });
    return res.status(201).json(ev);
  }

  res.status(405).json({ error: "Method not allowed" });
}
