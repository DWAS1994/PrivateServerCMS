// scripts/seed-demo.js — populates the demo with content so visitors see
// something meaningful instead of empty pages.
// Run after `prisma db push`: node scripts/seed-demo.js
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  // 1. ServerConfig
  await prisma.serverConfig.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      serverName: "Phoenix MMORPG (Demo)",
      motd: "Live demo — try the admin login: demo_admin / demopass123",
      maxPlayers: 2000,
      online: true,
      registrationOpen: true,
      experienceRate: 5.0,
      goldRate: 3.0,
      dropRate: 2.0,
      pvpEnabled: true,
    },
  });

  // 2. InstallState (demo is "installed")
  await prisma.installState.upsert({
    where: { id: 1 },
    update: { completed: true, completedAt: new Date() },
    create: { id: 1, completed: true, completedAt: new Date() },
  });

  // 3. Demo admin user
  const passwordHash = await bcrypt.hash("demopass123", 10);
  await prisma.user.upsert({
    where: { username: "demo_admin" },
    update: { role: "admin", passwordHash },
    create: {
      username: "demo_admin",
      email: "demo_admin@example.com",
      passwordHash,
      role: "admin",
      silk: 50000,
      level: 80,
      characterName: "ShadowBlade",
      characterClass: "Warrior",
    },
  });

  // 4. A handful of regular users to make the community look alive
  const players = [
    { username: "Aelinora", level: 72, class: "Mage", silk: 8200 },
    { username: "Thornwick", level: 65, class: "Rogue", silk: 4400 },
    { username: "Briarheart", level: 80, class: "Warrior", silk: 12000 },
    { username: "MorrigansVoid", level: 75, class: "Necromancer", silk: 6800 },
    { username: "KaelTheSwift", level: 70, class: "Archer", silk: 5100 },
  ];
  for (const p of players) {
    await prisma.user.upsert({
      where: { username: p.username },
      update: {},
      create: {
        username: p.username,
        email: `${p.username.toLowerCase()}@example.com`,
        passwordHash,
        role: "player",
        silk: p.silk,
        level: p.level,
        characterName: p.username,
        characterClass: p.class,
        online: Math.random() > 0.4,
      },
    });
  }

  // 5. Forum categories
  const cats = [
    { name: "Announcements", slug: "announcements", description: "Official news and updates", position: 1 },
    { name: "General Discussion", slug: "general", description: "Talk about anything", position: 2 },
    { name: "Guides & Strategy", slug: "guides", description: "Class guides, raid strategy, leveling", position: 3 },
    { name: "Trading", slug: "trading", description: "WTS / WTB / WTT", position: 4 },
    { name: "Bug Reports", slug: "bugs", description: "Found a bug? Report it here", position: 5 },
    { name: "Suggestions", slug: "suggestions", description: "Help shape the server", position: 6 },
  ];
  for (const c of cats) {
    await prisma.forumCategory.upsert({ where: { slug: c.slug }, update: {}, create: c });
  }

  // 6. Sample news posts
  const adminUser = await prisma.user.findUnique({ where: { username: "demo_admin" } });
  const newsItems = [
    {
      title: "Server officially live!",
      body: "After months of testing, Phoenix MMORPG is now live. Join us for double XP this weekend to celebrate.\n\nServer rates: 5x EXP, 3x Gold, 2x Drops. Active staff, fair economy, no pay-to-win.",
      category: "announcement",
      pinned: true,
      author: "demo_admin",
    },
    {
      title: "Patch v1.2 — Balance changes",
      body: "Mage damage reduced by 8% in PvP. Warrior shield block cooldown lowered from 30s → 22s. Full patch notes on the forum.",
      category: "patch",
      author: "demo_admin",
    },
    {
      title: "Castle Siege this Saturday",
      body: "First castle siege of the season is this Saturday at 20:00 UTC. Sign your guild up in the trading forum.",
      category: "event",
      author: "demo_admin",
    },
  ];
  for (const n of newsItems) {
    const existing = await prisma.newsPost.findFirst({ where: { title: n.title } });
    if (!existing) {
      await prisma.newsPost.create({ data: n });
    }
  }

  // 7. Sample events
  const now = Date.now();
  const events = [
    {
      title: "Crimson Dragon World Boss",
      description: "Server-wide dragon hunt. First guild to land the killing blow gets a unique trophy.",
      startsAt: new Date(now + 2 * 60 * 60 * 1000), // 2 hours from now
      endsAt: new Date(now + 3 * 60 * 60 * 1000),
      location: "Volcano Peak",
      rewards: "Unique drops, 50,000 silk to top damage dealer",
    },
    {
      title: "Double EXP Weekend",
      description: "10x EXP all weekend long. Bring your alts.",
      startsAt: new Date(now + 24 * 60 * 60 * 1000), // tomorrow
      endsAt: new Date(now + 4 * 24 * 60 * 60 * 1000),
      rewards: "2x EXP rate",
    },
    {
      title: "Guild War — Crimson vs Azure",
      description: "Top guild rivalry comes to a head. Bracket-style elimination, last guild standing takes the castle.",
      startsAt: new Date(now + 6 * 24 * 60 * 60 * 1000),
      location: "Northgate Fortress",
      rewards: "Castle ownership, weekly tax income",
    },
  ];
  for (const ev of events) {
    const existing = await prisma.gameEvent.findFirst({ where: { title: ev.title } });
    if (!existing) await prisma.gameEvent.create({ data: ev });
  }

  // 8. Sample monsters
  const monsters = [
    { name: "Cave Spider", level: 5, rarity: "common", zone: "Tutorial Caves", hp: 120, spawnRate: 30 },
    { name: "Forest Wolf", level: 12, rarity: "common", zone: "Greenwood Forest", hp: 350, spawnRate: 45 },
    { name: "Bandit Captain", level: 25, rarity: "rare", zone: "Bandit Camp", hp: 4500, spawnRate: 600 },
    { name: "Ancient Lich", level: 60, rarity: "unique", zone: "Forgotten Crypt", hp: 50000, spawnRate: 3600, description: "Spawns once per server hour." },
    { name: "Crimson Dragon", level: 80, rarity: "boss", zone: "Volcano Peak", hp: 500000, spawnRate: 14400, description: "World boss. Spawns every 4 hours." },
  ];
  for (const m of monsters) {
    await prisma.monster.upsert({ where: { name: m.name }, update: {}, create: m });
  }

  // 9. Recent kill log so /unique-history has data even without a game DB.
  // Only seed if empty so re-running the script doesn't pile up duplicates.
  const existingKillCount = await prisma.monsterKill.count();
  if (existingKillCount === 0) {
    const crimson = await prisma.monster.findUnique({ where: { name: "Crimson Dragon" } });
    const lich = await prisma.monster.findUnique({ where: { name: "Ancient Lich" } });
    const killSamples = [
      { mon: crimson, killer: "Briarheart",     hoursAgo: 0.3 },
      { mon: lich,    killer: "MorrigansVoid",  hoursAgo: 1.1 },
      { mon: lich,    killer: "Aelinora",       hoursAgo: 2.6 },
      { mon: crimson, killer: "KaelTheSwift",   hoursAgo: 4.2 },
      { mon: lich,    killer: "Thornwick",      hoursAgo: 5.8 },
      { mon: lich,    killer: "Briarheart",     hoursAgo: 7.1 },
      { mon: crimson, killer: "demo_admin",     hoursAgo: 9.4 },
      { mon: lich,    killer: "MorrigansVoid",  hoursAgo: 11.2 },
      { mon: lich,    killer: "Aelinora",       hoursAgo: 14.6 },
      { mon: crimson, killer: "Briarheart",     hoursAgo: 18.0 },
      { mon: lich,    killer: "KaelTheSwift",   hoursAgo: 22.3 },
      { mon: lich,    killer: "Thornwick",      hoursAgo: 28.5 },
    ];
    for (const k of killSamples) {
      if (!k.mon) continue;
      await prisma.monsterKill.create({
        data: {
          monsterId: k.mon.id,
          killerName: k.killer,
          zone: k.mon.zone,
          killedAt: new Date(Date.now() - k.hoursAgo * 3600 * 1000),
        },
      });
    }
  }

  // 9b. SOX drop log. Same idempotency rule.
  const existingDropCount = await prisma.soxDrop.count();
  if (existingDropCount === 0) {
    const soxSamples = [
      { player: "Briarheart",    item: "Heuksal Spear (Sun)",        rarity: "Sun",  degree: 11, hoursAgo: 0.5 },
      { player: "Aelinora",      item: "Sage's Robe (Moon)",         rarity: "Moon", degree: 10, hoursAgo: 1.3 },
      { player: "MorrigansVoid", item: "Necromancer's Wand (Star)",  rarity: "Star", degree: 9,  hoursAgo: 2.0 },
      { player: "KaelTheSwift",  item: "Wind Walker Bow (Moon)",     rarity: "Moon", degree: 10, hoursAgo: 3.8 },
      { player: "Thornwick",     item: "Shadowstep Dagger (Sun)",    rarity: "Sun",  degree: 11, hoursAgo: 5.5 },
      { player: "Briarheart",    item: "Guardian Plate (Star)",      rarity: "Star", degree: 9,  hoursAgo: 7.4 },
      { player: "Aelinora",      item: "Phoenix Earring (Moon)",     rarity: "Moon", degree: 10, hoursAgo: 9.1 },
      { player: "demo_admin",    item: "Crimson Crown (Sun)",        rarity: "Sun",  degree: 12, hoursAgo: 11.7 },
      { player: "MorrigansVoid", item: "Lich's Whisper Amulet (Sun)",rarity: "Sun",  degree: 11, hoursAgo: 13.2 },
      { player: "Thornwick",     item: "Silent Step Boots (Star)",   rarity: "Star", degree: 9,  hoursAgo: 16.8 },
      { player: "KaelTheSwift",  item: "Marksman's Gloves (Moon)",   rarity: "Moon", degree: 10, hoursAgo: 19.4 },
      { player: "Briarheart",    item: "Warlord's Shield (Sun)",     rarity: "Sun",  degree: 11, hoursAgo: 23.1 },
      { player: "Aelinora",      item: "Starlight Ring (Star)",      rarity: "Star", degree: 9,  hoursAgo: 27.5 },
    ];
    for (const d of soxSamples) {
      await prisma.soxDrop.create({
        data: {
          playerName: d.player,
          itemName: d.item,
          rarity: d.rarity,
          degree: d.degree,
          droppedAt: new Date(Date.now() - d.hoursAgo * 3600 * 1000),
        },
      });
    }
  }

  // 10. Welcome notification
  const existing = await prisma.notification.findFirst({
    where: { userId: null, title: { contains: "Welcome to the demo" } },
  });
  if (!existing) {
    await prisma.notification.create({
      data: {
        userId: null,
        type: "system",
        title: "Welcome to the demo!",
        body: "Sign in as demo_admin / demopass123 to see the admin panel. Or register a new account to try the player experience.",
        link: "/login",
      },
    });
  }

  // 10b. Download placeholder so /downloads has content on the demo.
  // Just the client — the public page is focused on a single download.
  // Real installs add their actual hosted URL via /admin/downloads.
  const existingDownloadCount = await prisma.downloadItem.count();
  if (existingDownloadCount === 0) {
    await prisma.downloadItem.create({
      data: {
        title: "Phoenix MMORPG — Full Client",
        description:
          "Complete game client. Includes all maps, models, audio, and the " +
          "launcher. Setup takes about 5 minutes after download finishes.",
        category: "client",
        url: "https://example.com/phoenix-client-1.4.2.zip",
        mirrorUrl: "https://example.com/mirror/phoenix-client-1.4.2.zip",
        fileSize: "2.4 GB",
        version: "v1.4.2",
        iconEmoji: "💾",
        featured: true,
        position: 0,
        downloads: 1487,
      },
    });
  }

  // 11. Some chat messages so /chat doesn't look empty
  const chatLines = [
    { author: "Briarheart", body: "anyone up for crimson dragon in 30?", min: 14 },
    { author: "Aelinora", body: "im in. let me grab pots", min: 13 },
    { author: "KaelTheSwift", body: "count me in. need the cape drop", min: 12 },
    { author: "MorrigansVoid", body: "guild discord up?", min: 10 },
    { author: "Thornwick", body: "just hit 65! anyone got a guide for the next tier?", min: 6 },
    { author: "demo_admin", body: "double xp weekend starts tomorrow, get your alts ready", min: 2 },
  ];
  for (const line of chatLines) {
    const u = await prisma.user.findUnique({ where: { username: line.author } });
    if (!u) continue;
    await prisma.chatMessage.create({
      data: {
        authorId: u.id,
        channel: "general",
        body: line.body,
        createdAt: new Date(Date.now() - line.min * 60 * 1000),
      },
    });
  }

  // 12. A sample forum thread so the forum isn't empty
  const general = await prisma.forumCategory.findUnique({ where: { slug: "general" } });
  if (general) {
    const existingThread = await prisma.forumThread.findFirst({
      where: { title: "Welcome — introduce yourself!" },
    });
    if (!existingThread) {
      const thread = await prisma.forumThread.create({
        data: {
          title: "Welcome — introduce yourself!",
          authorId: adminUser.id,
          categoryId: general.id,
          pinned: true,
          posts: {
            create: { authorId: adminUser.id, body: "New to Phoenix? Tell us your class and where you're from. Always good to see fresh faces." },
          },
        },
      });
      // A couple of replies
      const briarheart = await prisma.user.findUnique({ where: { username: "Briarheart" } });
      const aelinora = await prisma.user.findUnique({ where: { username: "Aelinora" } });
      if (briarheart) {
        await prisma.forumPost.create({
          data: { threadId: thread.id, authorId: briarheart.id, body: "Briarheart, Warrior, returning after 3 years away. Excited to be back." },
        });
      }
      if (aelinora) {
        await prisma.forumPost.create({
          data: { threadId: thread.id, authorId: aelinora.id, body: "Aelinora the Mage, first time on Phoenix. Heard good things — let's see if they hold up." },
        });
      }
      await prisma.forumThread.update({
        where: { id: thread.id },
        data: { updatedAt: new Date() },
      });
    }
  }

  console.log("✓ Demo seeded. Login: demo_admin / demopass123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
