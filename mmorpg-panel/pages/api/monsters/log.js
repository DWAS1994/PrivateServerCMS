// /api/monsters/log — POST spawn or kill events from the game server.
// Use a server-to-server shared secret in the X-Server-Token header.
import { prisma } from "@/lib/prisma";

const SERVER_TOKEN = process.env.GAME_SERVER_TOKEN || "";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // If a token is configured, require it. If not configured, allow (useful
  // for dev / single-machine setups). Production deployments should set one.
  if (SERVER_TOKEN && req.headers["x-server-token"] !== SERVER_TOKEN) {
    return res.status(401).json({ error: "Invalid server token" });
  }

  const { type, monsterName, killerName, killerId, zone } = req.body || {};
  if (!type || !monsterName) {
    return res.status(400).json({ error: "type and monsterName required" });
  }

  const monster = await prisma.monster.findUnique({ where: { name: monsterName } });
  if (!monster) {
    return res.status(404).json({ error: "Monster not found in registry" });
  }

  if (type === "spawn") {
    const spawn = await prisma.monsterSpawn.create({
      data: { monsterId: monster.id, zone: zone || monster.zone },
    });
    return res.status(201).json({ ok: true, spawn });
  }

  if (type === "kill") {
    const kill = await prisma.monsterKill.create({
      data: {
        monsterId: monster.id,
        killerName: killerName || "Unknown",
        killerId: killerId || null,
        zone: zone || monster.zone,
      },
    });
    return res.status(201).json({ ok: true, kill });
  }

  res.status(400).json({ error: "type must be 'spawn' or 'kill'" });
}
