// GET /api/server/status — live server stats for the homepage widget.
import { prisma } from "@/lib/prisma";

export default async function handler(req, res) {
  const config = await prisma.serverConfig.findUnique({ where: { id: 1 } });
  const onlineCount = await prisma.user.count({ where: { online: true } });
  const totalAccounts = await prisma.user.count();

  // 24h activity
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const kills24h = await prisma.monsterKill.count({
    where: { killedAt: { gte: since } },
  });

  res.json({
    serverName: config?.serverName ?? "Unnamed Server",
    motd: config?.motd ?? "",
    online: config?.online ?? false,
    maxPlayers: config?.maxPlayers ?? 0,
    onlinePlayers: onlineCount,
    totalAccounts,
    kills24h,
    rates: {
      experience: config?.experienceRate ?? 1,
      gold: config?.goldRate ?? 1,
      drop: config?.dropRate ?? 1,
    },
    pvpEnabled: config?.pvpEnabled ?? true,
  });
}
