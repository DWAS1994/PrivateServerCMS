// /api/admin/game-db
//   GET — current config (password redacted)
//   PUT — save config (password optional; omit to keep existing)
//   POST { test: true, host, port, ... } — test arbitrary settings
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { encrypt, decrypt } from "@/lib/crypto";
import {
  getSafeConfig,
  testConnection,
  invalidatePool,
} from "@/lib/gameDb";

export default async function handler(req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  // In demo mode we let admins look at the form (GET) but we refuse any
  // write/test attempts so the demo can't be used as a free MySQL prober.
  if (process.env.DEMO_MODE === "1" && req.method !== "GET") {
    return res.status(403).json({
      error: "Game DB integration is disabled in demo mode.",
    });
  }

  if (req.method === "GET") {
    const config = (await getSafeConfig()) || {
      id: 1,
      enabled: false,
      host: "127.0.0.1",
      port: 3306,
      database: "",
      user: "",
      passwordSet: false,
      accountTable: "TB_User",
      accountIdCol: "JID",
      accountUserCol: "StrUserID",
      accountPassCol: "password",
      accountEmailCol: "Email",
      uniqueKillTable: "_UniqueKillLog",
      rareDropTable: "_SoxItemLog",
    };
    return res.json({ config });
  }

  if (req.method === "POST") {
    // "Test only" — don't save
    const { host, port, database, user, password } = req.body || {};
    if (!host || !database || !user) {
      return res.status(400).json({ error: "host, database, and user are required to test." });
    }
    const result = await testConnection({ host, port, database, user, password: password || "" });
    return res.json(result);
  }

  if (req.method === "PUT") {
    const {
      enabled,
      host, port, database, user, password,
      accountTable, accountIdCol, accountUserCol, accountPassCol, accountEmailCol,
      uniqueKillTable, rareDropTable,
    } = req.body || {};

    const data = {};
    if (enabled !== undefined) data.enabled = !!enabled;
    if (host !== undefined) data.host = String(host).slice(0, 200);
    if (port !== undefined) data.port = Math.max(1, parseInt(port, 10) || 3306);
    if (database !== undefined) data.database = String(database).slice(0, 100);
    if (user !== undefined) data.user = String(user).slice(0, 100);
    // Only update password if non-empty (so the form can save other fields
    // without re-entering the password every time)
    if (password) data.passwordEnc = encrypt(password);
    if (accountTable !== undefined) data.accountTable = String(accountTable).slice(0, 64);
    if (accountIdCol !== undefined) data.accountIdCol = String(accountIdCol).slice(0, 64);
    if (accountUserCol !== undefined) data.accountUserCol = String(accountUserCol).slice(0, 64);
    if (accountPassCol !== undefined) data.accountPassCol = String(accountPassCol).slice(0, 64);
    if (accountEmailCol !== undefined) data.accountEmailCol = String(accountEmailCol).slice(0, 64);
    if (uniqueKillTable !== undefined) data.uniqueKillTable = String(uniqueKillTable).slice(0, 64);
    if (rareDropTable !== undefined) data.rareDropTable = String(rareDropTable).slice(0, 64);

    // Record whether the most recent test succeeded — handy for the dashboard
    // Run a quick test if we have enough info
    if (
      data.enabled &&
      (data.host || (await prisma.gameDbConfig.findUnique({ where: { id: 1 } }))?.host)
    ) {
      const existing = await prisma.gameDbConfig.findUnique({ where: { id: 1 } });
      const merged = { ...existing, ...data };
      const pw = password || (existing ? decrypt(existing.passwordEnc) : "");
      const result = await testConnection({
        host: merged.host,
        port: merged.port,
        database: merged.database,
        user: merged.user,
        password: pw,
      });
      data.lastTestedAt = new Date();
      data.lastTestOk = result.ok;
      data.lastTestError = result.ok ? null : result.error;
    }

    const saved = await prisma.gameDbConfig.upsert({
      where: { id: 1 },
      update: data,
      create: { id: 1, ...data },
    });

    // Force pool rebuild on next query
    invalidatePool();

    const { passwordEnc, ...safe } = saved;
    return res.json({
      config: {
        ...safe,
        passwordSet: !!passwordEnc,
        lastTestedAt: saved.lastTestedAt?.toISOString() || null,
        updatedAt: saved.updatedAt.toISOString(),
      },
    });
  }

  res.status(405).json({ error: "Method not allowed" });
}
