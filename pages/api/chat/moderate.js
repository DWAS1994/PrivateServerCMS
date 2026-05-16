// /api/chat/moderate — admin/GM moderation actions against a user from chat.
//
// Body: { userId, action, minutes?, reason? }
//   action = "mute"      — set mutedUntil = now + minutes (default 10)
//   action = "unmute"    — clear mutedUntil
//   action = "ban"       — set banned = true with reason (admin only)
//   action = "unban"     — clear banned (admin only)
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const me = await requireUser(req, res);
  if (!me) return;
  if (me.role !== "admin" && me.role !== "gm") {
    return res.status(403).json({ error: "Admins or GMs only." });
  }

  const { userId, action, minutes, reason } = req.body || {};
  if (!userId || !action) {
    return res.status(400).json({ error: "userId and action required." });
  }
  const target = await prisma.user.findUnique({ where: { id: parseInt(userId, 10) } });
  if (!target) return res.status(404).json({ error: "User not found." });

  // Don't let moderators escalate against admins
  if (target.role === "admin") {
    return res.status(403).json({ error: "Can't moderate admins." });
  }
  // GMs can't ban — only admins can. Both can mute.
  if (action === "ban" || action === "unban") {
    if (me.role !== "admin") {
      return res.status(403).json({ error: "Ban / unban is admin-only." });
    }
  }

  if (action === "mute") {
    const mins = Math.max(1, Math.min(parseInt(minutes, 10) || 10, 60 * 24 * 30)); // cap at 30 days
    const mutedUntil = new Date(Date.now() + mins * 60 * 1000);
    await prisma.user.update({
      where: { id: target.id },
      data: { mutedUntil, muteReason: reason ? String(reason).slice(0, 200) : null },
    });
    return res.json({ ok: true, mutedUntil: mutedUntil.toISOString(), minutes: mins });
  }

  if (action === "unmute") {
    await prisma.user.update({
      where: { id: target.id },
      data: { mutedUntil: null, muteReason: null },
    });
    return res.json({ ok: true });
  }

  if (action === "ban") {
    await prisma.user.update({
      where: { id: target.id },
      data: { banned: true, banReason: reason ? String(reason).slice(0, 200) : "Banned via chat moderation." },
    });
    return res.json({ ok: true });
  }

  if (action === "unban") {
    await prisma.user.update({
      where: { id: target.id },
      data: { banned: false, banReason: null },
    });
    return res.json({ ok: true });
  }

  return res.status(400).json({ error: "Unknown action." });
}
