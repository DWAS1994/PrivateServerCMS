// Singleton Prisma client — prevents connection-pool exhaustion in Next.js dev
// (where modules hot-reload). In production this is a regular singleton.
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// ─────────────────────────────────────────────────────────────────────
// Serialization helpers for getServerSideProps.
// Next.js can't serialize Date objects across the props boundary, so any
// page that passes Prisma rows in props must convert Dates to ISO strings.
// ─────────────────────────────────────────────────────────────────────

/** Convert any Date fields on `obj` to ISO strings, recursively (shallow on arrays). */
export function serializeDates(obj) {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Date) return obj.toISOString();
  if (Array.isArray(obj)) return obj.map(serializeDates);
  if (typeof obj === "object") {
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[k] = serializeDates(v);
    return out;
  }
  return obj;
}

/** Specifically serialize a ServerConfig row for getServerSideProps. */
export function serializeServer(server) {
  if (!server) return null;
  return serializeDates(server);
}
