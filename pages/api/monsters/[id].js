// /api/monsters/[id] — PUT update, DELETE remove
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export default async function handler(req, res) {
  const id = parseInt(req.query.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Bad id" });

  if (req.method === "PUT") {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const { name, level, rarity, zone, hp, spawnRate, description } = req.body || {};
    const m = await prisma.monster.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: String(name).slice(0, 100) }),
        ...(level !== undefined && { level: parseInt(level, 10) || 1 }),
        ...(rarity !== undefined && {
          rarity: ["common", "rare", "unique", "boss"].includes(rarity) ? rarity : "common",
        }),
        ...(zone !== undefined && { zone: zone || null }),
        ...(hp !== undefined && { hp: parseInt(hp, 10) || 1000 }),
        ...(spawnRate !== undefined && { spawnRate: parseInt(spawnRate, 10) || 60 }),
        ...(description !== undefined && { description: description || null }),
      },
    });
    return res.json(m);
  }

  if (req.method === "DELETE") {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    await prisma.monster.delete({ where: { id } });
    return res.json({ ok: true });
  }

  res.status(405).json({ error: "Method not allowed" });
}
