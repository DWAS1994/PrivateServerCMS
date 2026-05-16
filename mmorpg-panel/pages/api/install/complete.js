// POST /api/install/complete — finalise install: save server name + MOTD,
// mark install completed, set up seed data.
import { prisma } from "@/lib/prisma";
import { isInstalled, markInstalled } from "@/lib/license";

const DEFAULT_CATEGORIES = [
  { name: "Announcements", slug: "announcements", description: "Official news and updates", position: 1 },
  { name: "General Discussion", slug: "general", description: "Talk about anything", position: 2 },
  { name: "Guides & Strategy", slug: "guides", description: "Class guides, raid strategy, leveling", position: 3 },
  { name: "Trading", slug: "trading", description: "WTS / WTB / WTT", position: 4 },
  { name: "Bug Reports", slug: "bugs", description: "Found a bug? Report it here", position: 5 },
  { name: "Suggestions", slug: "suggestions", description: "Help shape the server", position: 6 },
];

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (await isInstalled()) {
    return res.status(403).json({ error: "Install already completed." });
  }

  // Sanity check: require both license + admin to have been set up
  const license = await prisma.license.findUnique({ where: { id: 1 } });
  if (!license || !license.key || license.status !== "active") {
    return res.status(412).json({ error: "License step not completed." });
  }
  const adminCount = await prisma.user.count({ where: { role: "admin" } });
  if (adminCount === 0) {
    return res.status(412).json({ error: "Admin user step not completed." });
  }

  const { serverName, motd } = req.body || {};
  if (!serverName || serverName.length > 100) {
    return res.status(400).json({ error: "Server name required (1–100 chars)." });
  }

  // Save server config (creates the singleton if it doesn't exist)
  await prisma.serverConfig.upsert({
    where: { id: 1 },
    update: { serverName, motd: motd || "" },
    create: {
      id: 1,
      serverName,
      motd: motd || "Welcome, adventurer!",
    },
  });

  // Seed forum categories if missing — same set the old `db:seed` used to
  // create, but conditional so we don't fight an existing forum.
  for (const c of DEFAULT_CATEGORIES) {
    await prisma.forumCategory.upsert({
      where: { slug: c.slug },
      update: {},
      create: c,
    });
  }

  // Welcome global notification
  await prisma.notification.create({
    data: {
      userId: null,
      type: "system",
      title: "Welcome to your new MMORPG Panel!",
      body: "You're now running on a licensed install. Visit Admin → Server Settings to configure further.",
      link: "/news",
    },
  });

  await markInstalled();
  res.json({ ok: true });
}
