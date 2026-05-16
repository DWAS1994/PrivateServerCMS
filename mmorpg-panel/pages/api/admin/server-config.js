// /api/admin/server-config — GET / PUT (admin only)
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export default async function handler(req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  if (req.method === "GET") {
    const c = await prisma.serverConfig.findUnique({ where: { id: 1 } });
    return res.json(c);
  }

  if (req.method === "PUT") {
    const {
      serverName, motd, maxPlayers, online, registrationOpen,
      experienceRate, goldRate, dropRate, pvpEnabled,
    } = req.body || {};

    const data = {};
    if (serverName !== undefined) data.serverName = String(serverName).slice(0, 100);
    if (motd !== undefined) data.motd = String(motd).slice(0, 500);
    if (maxPlayers !== undefined) data.maxPlayers = Math.max(1, parseInt(maxPlayers, 10) || 1);
    if (online !== undefined) data.online = !!online;
    if (registrationOpen !== undefined) data.registrationOpen = !!registrationOpen;
    if (experienceRate !== undefined) data.experienceRate = Math.max(0.01, parseFloat(experienceRate) || 1);
    if (goldRate !== undefined) data.goldRate = Math.max(0.01, parseFloat(goldRate) || 1);
    if (dropRate !== undefined) data.dropRate = Math.max(0.01, parseFloat(dropRate) || 1);
    if (pvpEnabled !== undefined) data.pvpEnabled = !!pvpEnabled;

    const updated = await prisma.serverConfig.upsert({
      where: { id: 1 },
      update: data,
      create: { id: 1, ...data },
    });
    return res.json(updated);
  }

  res.status(405).json({ error: "Method not allowed" });
}
