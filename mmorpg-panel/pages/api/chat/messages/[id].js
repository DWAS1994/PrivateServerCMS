// /api/chat/messages/[id] — DELETE soft-deletes a chat message (admin/GM only).
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export default async function handler(req, res) {
  if (req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const user = await requireUser(req, res);
  if (!user) return;
  if (user.role !== "admin" && user.role !== "gm") {
    return res.status(403).json({ error: "Admins or GMs only." });
  }

  const id = parseInt(req.query.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Bad id" });

  await prisma.chatMessage.update({
    where: { id },
    data: { deleted: true },
  });
  return res.json({ ok: true });
}
