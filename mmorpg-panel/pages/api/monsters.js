// /api/monsters — GET list with recent spawn/kill counts; POST create (admin)
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export default async function handler(req, res) {
  if (req.method === "GET") {
    // Bring back monsters along with counts of recent activity. We focus on
    // the rare/unique/boss tiers — that's what players actually want to track.
    const monsters = await prisma.monster.findMany({
      orderBy: [{ rarity: "desc" }, { level: "desc" }],
      include: {
        _count: { select: { spawns: true, kills: true } },
      },
    });
    res.json(monsters);
    return;
  }

  if (req.method === "POST") {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const { name, level, rarity, zone, hp, spawnRate, description } = req.body || {};
    if (!name) return res.status(400).json({ error: "Name required." });
    try {
      const m = await prisma.monster.create({
        data: {
          name: String(name).slice(0, 100),
          level: parseInt(level, 10) || 1,
          rarity: ["common", "rare", "unique", "boss"].includes(rarity) ? rarity : "common",
          zone: zone || null,
          hp: parseInt(hp, 10) || 1000,
          spawnRate: parseInt(spawnRate, 10) || 60,
          description: description || null,
        },
      });
      res.status(201).json(m);
    } catch (e) {
      if (e.code === "P2002") {
        return res.status(409).json({ error: "Monster with that name already exists." });
      }
      throw e;
    }
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
