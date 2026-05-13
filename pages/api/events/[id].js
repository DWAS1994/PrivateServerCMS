// /api/events/[id] — PUT update, DELETE remove
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export default async function handler(req, res) {
  const id = parseInt(req.query.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Bad id" });

  if (req.method === "PUT") {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const { title, description, startsAt, endsAt, location, rewards } = req.body || {};
    const ev = await prisma.gameEvent.update({
      where: { id },
      data: {
        ...(title !== undefined && { title: String(title).slice(0, 200) }),
        ...(description !== undefined && { description: String(description) }),
        ...(startsAt !== undefined && { startsAt: new Date(startsAt) }),
        ...(endsAt !== undefined && { endsAt: endsAt ? new Date(endsAt) : null }),
        ...(location !== undefined && { location: location || null }),
        ...(rewards !== undefined && { rewards: rewards || null }),
      },
    });
    return res.json(ev);
  }

  if (req.method === "DELETE") {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    await prisma.gameEvent.delete({ where: { id } });
    return res.json({ ok: true });
  }

  res.status(405).json({ error: "Method not allowed" });
}
