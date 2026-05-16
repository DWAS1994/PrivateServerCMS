// POST /api/downloads/[id]/track — bumps the download counter.
// Fire-and-forget from the public page; no auth needed.
import { prisma } from "@/lib/prisma";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const id = parseInt(req.query.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Bad id" });

  // Best-effort: don't error if the row doesn't exist
  await prisma.downloadItem
    .update({ where: { id }, data: { downloads: { increment: 1 } } })
    .catch(() => {});
  return res.json({ ok: true });
}
