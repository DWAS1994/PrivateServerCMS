// scripts/use-postgres.js — swaps the Prisma datasource provider to
// postgresql in place. Used by Vercel's build command:
//   "vercel-build": "node scripts/use-postgres.js && prisma generate && prisma db push --accept-data-loss && next build"
//
// Local dev with SQLite keeps using the default schema.prisma.
const fs = require("fs");
const path = require("path");

const schemaPath = path.join(__dirname, "..", "prisma", "schema.prisma");
let schema = fs.readFileSync(schemaPath, "utf8");

const wanted = 'provider = "postgresql"';
const old = /provider\s*=\s*"sqlite"/;

if (schema.match(old)) {
  schema = schema.replace(old, wanted);
  fs.writeFileSync(schemaPath, schema);
  console.log("✓ Prisma provider switched to postgresql");
} else if (schema.includes(wanted)) {
  console.log("✓ Prisma provider already postgresql");
} else {
  console.warn("⚠ Couldn't find sqlite provider line — leaving schema alone");
}
