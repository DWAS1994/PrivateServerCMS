// prisma/seed.js — initial database state
// Run with: npm run db:seed
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  // 1. Server config (singleton)
  await prisma.serverConfig.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      serverName: process.env.NEXT_PUBLIC_SITE_NAME || "My MMORPG Server",
      motd: "Welcome, adventurer! The realm awaits.",
      maxPlayers: 1000,
      online: true,
      registrationOpen: true,
      experienceRate: 1.0,
      goldRate: 1.0,
      dropRate: 1.0,
      pvpEnabled: true,
    },
  });
  console.log("✓ ServerConfig seeded");

  // 2. Admin user
  const adminUsername = process.env.SEED_ADMIN_USERNAME || "admin";
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@localhost";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "changeme";
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  await prisma.user.upsert({
    where: { username: adminUsername },
    update: { role: "admin" },
    create: {
      username: adminUsername,
      email: adminEmail,
      passwordHash,
      role: "admin",
      silk: 0,
      level: 1,
    },
  });
  console.log(`✓ Admin user created: ${adminUsername} / ${adminPassword}`);

  // 3. Forum categories
  const categories = [
    { name: "Announcements", slug: "announcements", description: "Official news and updates", position: 1 },
    { name: "General Discussion", slug: "general", description: "Talk about anything", position: 2 },
    { name: "Guides & Strategy", slug: "guides", description: "Class guides, raid strategy, leveling", position: 3 },
    { name: "Trading", slug: "trading", description: "WTS / WTB / WTT", position: 4 },
    { name: "Bug Reports", slug: "bugs", description: "Found a bug? Report it here", position: 5 },
    { name: "Suggestions", slug: "suggestions", description: "Help shape the server", position: 6 },
  ];
  for (const c of categories) {
    await prisma.forumCategory.upsert({ where: { slug: c.slug }, update: {}, create: c });
  }
  console.log("✓ Forum categories seeded");

  // 4. Sample monsters (admins typically import their game's mob list)
  const monsters = [
    { name: "Cave Spider", level: 5, rarity: "common", zone: "Tutorial Caves", hp: 120, spawnRate: 30 },
    { name: "Goblin Scout", level: 8, rarity: "common", zone: "Greenwood Forest", hp: 200, spawnRate: 30 },
    { name: "Forest Wolf", level: 12, rarity: "common", zone: "Greenwood Forest", hp: 350, spawnRate: 45 },
    { name: "Bandit Captain", level: 25, rarity: "rare", zone: "Bandit Camp", hp: 4500, spawnRate: 600 },
    { name: "Ancient Lich", level: 60, rarity: "unique", zone: "Forgotten Crypt", hp: 50000, spawnRate: 3600,
      description: "Spawns once per server hour. Drops Lich's Phylactery." },
    { name: "Crimson Dragon", level: 80, rarity: "boss", zone: "Volcano Peak", hp: 500000, spawnRate: 14400,
      description: "World boss. Spawns every 4 hours." },
  ];
  for (const m of monsters) {
    await prisma.monster.upsert({ where: { name: m.name }, update: {}, create: m });
  }
  console.log("✓ Sample monsters seeded");

  // 5. A welcome global notification so the bell has something on first run
  const welcomeExists = await prisma.notification.findFirst({
    where: { userId: null, title: "Welcome to the server!" },
  });
  if (!welcomeExists) {
    await prisma.notification.create({
      data: {
        userId: null,
        type: "system",
        title: "Welcome to the server!",
        body: "Visit the forum, join Live Chat, and check the events page for upcoming festivities.",
        link: "/news",
      },
    });
    console.log("✓ Welcome notification posted");
  }

  console.log("\nSeed complete. Login at /login with:");
  console.log(`  Username: ${adminUsername}`);
  console.log(`  Password: ${adminPassword}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
