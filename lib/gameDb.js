// Live connection to the *game's* MySQL database (separate from the panel's
// own Prisma DB). Configured via /admin/game-db. The pool is rebuilt whenever
// the saved config changes, and queries throw a friendly error if no game DB
// is configured yet.
//
// We use a singleton on globalThis so Next.js's hot-reload in dev doesn't
// leak connections.
import mysql from "mysql2/promise";
import { prisma } from "./prisma";
import { decrypt } from "./crypto";

const globalForGameDb = globalThis;
if (!globalForGameDb.__gameDb) {
  globalForGameDb.__gameDb = { pool: null, configSig: null, lastConfig: null };
}

// Build a "signature" for the current config — if it changes, we know to
// rebuild the pool.
function sig(c) {
  if (!c) return "none";
  return `${c.enabled}|${c.host}|${c.port}|${c.database}|${c.user}|${c.passwordEnc}`;
}

async function loadConfig() {
  return prisma.gameDbConfig.findUnique({ where: { id: 1 } });
}

async function getPool() {
  const config = await loadConfig();
  if (!config || !config.enabled) {
    throw new Error("Game DB is not configured. Connect it in Admin → Game DB.");
  }
  const newSig = sig(config);
  if (
    globalForGameDb.__gameDb.pool &&
    globalForGameDb.__gameDb.configSig === newSig
  ) {
    return { pool: globalForGameDb.__gameDb.pool, config };
  }
  // Tear down old pool if there is one
  if (globalForGameDb.__gameDb.pool) {
    try {
      await globalForGameDb.__gameDb.pool.end();
    } catch {}
  }
  globalForGameDb.__gameDb.pool = mysql.createPool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: decrypt(config.passwordEnc),
    waitForConnections: true,
    connectionLimit: 5,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
  });
  globalForGameDb.__gameDb.configSig = newSig;
  globalForGameDb.__gameDb.lastConfig = config;
  return { pool: globalForGameDb.__gameDb.pool, config };
}

/** Returns true if the game DB has been enabled in admin. */
export async function isEnabled() {
  const c = await loadConfig();
  return !!(c && c.enabled);
}

/** Run a SELECT against the game DB and return rows. Throws if not configured. */
export async function gameQuery(sql, params = []) {
  const { pool } = await getPool();
  const [rows] = await pool.query(sql, params);
  return rows;
}

/** Convenience: get the config object (with passwordEnc redacted). */
export async function getSafeConfig() {
  const c = await loadConfig();
  if (!c) return null;
  const { passwordEnc, ...rest } = c;
  return { ...rest, passwordSet: !!passwordEnc };
}

/**
 * Test the connection with arbitrary settings (without saving them).
 * Used by the "Test connection" button on the admin form.
 */
export async function testConnection({ host, port, database, user, password }) {
  let connection = null;
  try {
    connection = await mysql.createConnection({
      host,
      port: parseInt(port, 10) || 3306,
      database,
      user,
      password,
      connectTimeout: 5000,
    });
    await connection.ping();
    const [rows] = await connection.query("SELECT VERSION() AS version");
    return { ok: true, version: rows[0]?.version || "unknown" };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    if (connection) {
      try { await connection.end(); } catch {}
    }
  }
}

/** Force the pool to rebuild on the next query (e.g. after config save). */
export function invalidatePool() {
  if (globalForGameDb.__gameDb.pool) {
    globalForGameDb.__gameDb.pool.end().catch(() => {});
  }
  globalForGameDb.__gameDb.pool = null;
  globalForGameDb.__gameDb.configSig = null;
}

// ─────────────────────────────────────────────────────────────────────
// High-level queries used by the public pages.
// These use the column/table names from GameDbConfig so they can be
// adjusted per emulator without code changes.
// ─────────────────────────────────────────────────────────────────────

/**
 * Create a new account in the game's account table.
 * Returns { id } on success or throws.
 *
 * Note: the game's password hashing scheme varies by emulator. This default
 * stores the password as-is (some emulators do their own hashing on the
 * authserver side). Adjust to match your server.
 */
export async function createGameAccount({ username, password, email }) {
  const { pool, config } = await getPool();
  const tbl = config.accountTable;
  const userCol = config.accountUserCol;
  const passCol = config.accountPassCol;
  const emailCol = config.accountEmailCol;

  // Insert. Different emulators have different required columns — this is
  // the minimum vsro-style set. Override the query if your schema needs more.
  const cols = [userCol, passCol];
  const placeholders = ["?", "?"];
  const values = [username, password];
  if (email && emailCol) {
    cols.push(emailCol);
    placeholders.push("?");
    values.push(email);
  }
  const sql = `INSERT INTO \`${tbl}\` (${cols.map((c) => `\`${c}\``).join(",")}) VALUES (${placeholders.join(",")})`;
  const [result] = await pool.query(sql, values);
  return { id: result.insertId };
}

/**
 * Check whether a username already exists in the game's account table.
 */
export async function gameAccountExists(username) {
  const { pool, config } = await getPool();
  const sql = `SELECT \`${config.accountIdCol}\` AS id FROM \`${config.accountTable}\` WHERE \`${config.accountUserCol}\` = ? LIMIT 1`;
  const [rows] = await pool.query(sql, [username]);
  return rows.length > 0;
}

/**
 * Pull recent unique-monster kills from the game DB.
 * Returns an array of { killer, monster, killedAt }.
 */
export async function recentUniqueKills(limit = 50) {
  const { pool, config } = await getPool();
  // We assume a fairly common schema; if your column names differ, edit here.
  // Common vsro layout: _UniqueKillLog(KillerName, MonsterName, EventTime) or
  // (CharID, MobID, time). We try a few permutations.
  const tbl = config.uniqueKillTable;
  const sql = `SELECT * FROM \`${tbl}\` ORDER BY 1 DESC LIMIT ?`;
  const [rows] = await pool.query(sql, [limit]);
  // Normalize a few likely column names
  return rows.map((r) => ({
    killer:
      r.KillerName ||
      r.CharName ||
      r.charname ||
      r.killer ||
      (r.CharID ? `Char#${r.CharID}` : "Unknown"),
    monster:
      r.MonsterName ||
      r.MobName ||
      r.NpcName ||
      r.monster ||
      (r.MobID ? `Mob#${r.MobID}` : "Unknown"),
    killedAt:
      r.EventTime ||
      r.time ||
      r.LogTime ||
      r.killedAt ||
      r.UpdateTime ||
      null,
    raw: r,
  }));
}

/**
 * Pull recent SOX (rare) item drops from the game DB.
 * Returns an array of { player, item, degree, rarity, droppedAt }.
 */
export async function recentSoxDrops(limit = 50) {
  const { pool, config } = await getPool();
  const tbl = config.rareDropTable;
  const sql = `SELECT * FROM \`${tbl}\` ORDER BY 1 DESC LIMIT ?`;
  const [rows] = await pool.query(sql, [limit]);
  return rows.map((r) => ({
    player:
      r.CharName ||
      r.charname ||
      r.player ||
      (r.CharID ? `Char#${r.CharID}` : "Unknown"),
    item:
      r.ItemName ||
      r.itemname ||
      r.item ||
      (r.ItemID ? `Item#${r.ItemID}` : "Unknown"),
    degree: r.Degree || r.degree || r.OptLevel || null,
    rarity: r.Rarity || r.rarity || r.SoxType || null,
    droppedAt:
      r.EventTime ||
      r.time ||
      r.LogTime ||
      r.DropTime ||
      r.UpdateTime ||
      null,
    raw: r,
  }));
}
