// /api/admin/downloads
//   GET           — list all downloads (admin only)
//   POST          — create a new download item
//   PUT  { id }   — update an existing item
//   DELETE { id } — remove permanently
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

const VALID_CATEGORIES = ["client", "patcher", "tools", "optional"];

function sanitize(input) {
  const data = {};
  if (typeof input.title === "string") data.title = input.title.trim().slice(0, 200);
  if (typeof input.description === "string") data.description = input.description.slice(0, 2000);
  if (typeof input.category === "string" && VALID_CATEGORIES.includes(input.category))
    data.category = input.category;
  if (typeof input.url === "string") data.url = input.url.trim().slice(0, 1000);
  if (typeof input.mirrorUrl === "string") data.mirrorUrl = input.mirrorUrl.trim().slice(0, 1000) || null;
  if (typeof input.fileSize === "string") data.fileSize = input.fileSize.trim().slice(0, 32) || null;
  if (typeof input.version === "string") data.version = input.version.trim().slice(0, 32) || null;
  if (typeof input.iconEmoji === "string") data.iconEmoji = input.iconEmoji.trim().slice(0, 8) || null;
  if (typeof input.featured === "boolean") data.featured = input.featured;
  if (typeof input.hidden === "boolean") data.hidden = input.hidden;
  if (typeof input.position === "number") data.position = input.position;
  if (typeof input.notes === "string") data.notes = input.notes.slice(0, 1000) || null;
  return data;
}

function validateForCreate(data) {
  if (!data.title) return "Title is required.";
  if (!data.url) return "URL is required.";
  try { new URL(data.url); } catch { return "URL is invalid."; }
  if (data.mirrorUrl) {
    try { new URL(data.mirrorUrl); } catch { return "Mirror URL is invalid."; }
  }
  return null;
}

export default async function handler(req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  if (req.method === "GET") {
    const items = await prisma.downloadItem.findMany({
      orderBy: [{ category: "asc" }, { position: "asc" }, { id: "asc" }],
    });
    return res.json({
      items: items.map((i) => ({
        ...i,
        createdAt: i.createdAt.toISOString(),
        updatedAt: i.updatedAt.toISOString(),
      })),
    });
  }

  if (req.method === "POST") {
    const data = sanitize(req.body || {});
    if (!data.category) data.category = "client";
    const err = validateForCreate(data);
    if (err) return res.status(400).json({ error: err });
    const item = await prisma.downloadItem.create({ data });
    return res.status(201).json({ item });
  }

  if (req.method === "PUT") {
    const id = parseInt(req.body?.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "id required" });
    const existing = await prisma.downloadItem.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Not found" });
    const data = sanitize(req.body || {});
    // For PUT, only validate URL if it's present
    if (data.url) {
      try { new URL(data.url); } catch { return res.status(400).json({ error: "URL is invalid." }); }
    }
    const item = await prisma.downloadItem.update({ where: { id }, data });
    return res.json({ item });
  }

  if (req.method === "DELETE") {
    const id = parseInt(req.body?.id || req.query?.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "id required" });
    await prisma.downloadItem.delete({ where: { id } }).catch(() => {});
    return res.json({ ok: true });
  }

  res.status(405).json({ error: "Method not allowed" });
}
