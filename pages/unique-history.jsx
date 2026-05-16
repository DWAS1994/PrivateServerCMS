// /unique-history — recent unique-monster kills.
// Pulls from the game DB when connected; falls back to the panel's local
// MonsterKill table for demo / standalone installs.
import Layout from "@/components/Layout";
import { prisma, serializeServer } from "@/lib/prisma";
import { getCurrentUser, publicUser } from "@/lib/auth";
import * as gameDb from "@/lib/gameDb";

export async function getServerSideProps({ req, res }) {
  const [user, server, enabled] = await Promise.all([
    getCurrentUser(req, res),
    prisma.serverConfig.findUnique({ where: { id: 1 } }),
    gameDb.isEnabled(),
  ]);

  let kills = [];
  let error = null;
  let source = "demo"; // "live" if pulled from game DB, "demo" if local fallback

  if (enabled) {
    try {
      const rows = await gameDb.recentUniqueKills(100);
      kills = rows.map((r) => ({
        killer: r.killer,
        monster: r.monster,
        killedAt:
          r.killedAt instanceof Date
            ? r.killedAt.toISOString()
            : r.killedAt
            ? String(r.killedAt)
            : null,
      }));
      source = "live";
    } catch (e) {
      error = e.message;
    }
  }

  // Fallback: pull unique-tier kills from the panel's own MonsterKill table.
  // Used on the demo install, or as a graceful fallback when the game DB
  // connection drops.
  if (!enabled || (kills.length === 0 && !error)) {
    const localKills = await prisma.monsterKill.findMany({
      where: { monster: { rarity: { in: ["unique", "boss"] } } },
      include: { monster: true },
      orderBy: { killedAt: "desc" },
      take: 100,
    });
    kills = localKills.map((k) => ({
      killer: k.killerName,
      monster: k.monster.name,
      killedAt: k.killedAt.toISOString(),
    }));
    source = "demo";
  }

  return {
    props: {
      user: publicUser(user),
      server: serializeServer(server),
      enabled,
      kills,
      error,
      source,
    },
  };
}

function timeAgo(iso) {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (isNaN(ms)) return iso;
  if (ms < 60000) return "just now";
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function UniqueHistory({ user, server, enabled, kills, error, source }) {
  // Compute aggregate "top killer" and "most killed monster"
  const killerCounts = {};
  const monsterCounts = {};
  for (const k of kills) {
    killerCounts[k.killer] = (killerCounts[k.killer] || 0) + 1;
    monsterCounts[k.monster] = (monsterCounts[k.monster] || 0) + 1;
  }
  const topKillers = Object.entries(killerCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const topMonsters = Object.entries(monsterCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <Layout user={user} server={server}>
      <div className="container page">
        <div className="page-header">
          <div>
            <div className="kicker">Live from game database</div>
            <div className="kicker">
              {source === "live" ? "Live from game database" : "Demo data"}
            </div>
            <h1 className="page-title">Unique History</h1>
            <p className="page-subtitle">
              {kills.length} recent unique kills
            </p>
          </div>
        </div>

        {error && (
          <div className="alert alert-error">
            <b>Couldn't load kills from the game database:</b> {error}
          </div>
        )}

        {kills.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24 }}>
            <div className="card">
              <table className="table">
                <thead>
                  <tr>
                    <th>Killer</th>
                    <th>Monster</th>
                    <th style={{ textAlign: "right" }}>When</th>
                  </tr>
                </thead>
                <tbody>
                  {kills.map((k, i) => (
                    <tr key={i}>
                      <td><b>{k.killer}</b></td>
                      <td style={{ color: "var(--gold)" }}>{k.monster}</td>
                      <td className="muted" style={{ textAlign: "right", fontSize: 12 }}>
                        {timeAgo(k.killedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="card">
                <div className="card-section">
                  <div className="kicker">Top killers (last 100)</div>
                </div>
                {topKillers.length === 0 ? (
                  <div className="muted" style={{ padding: 20, textAlign: "center", fontSize: 13 }}>
                    No data
                  </div>
                ) : (
                  <table className="table">
                    <tbody>
                      {topKillers.map(([name, count]) => (
                        <tr key={name}>
                          <td><b>{name}</b></td>
                          <td style={{ textAlign: "right" }} className="mono">{count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="card">
                <div className="card-section">
                  <div className="kicker">Most-killed uniques</div>
                </div>
                {topMonsters.length === 0 ? (
                  <div className="muted" style={{ padding: 20, textAlign: "center", fontSize: 13 }}>
                    No data
                  </div>
                ) : (
                  <table className="table">
                    <tbody>
                      {topMonsters.map(([name, count]) => (
                        <tr key={name}>
                          <td style={{ color: "var(--gold)" }}>{name}</td>
                          <td style={{ textAlign: "right" }} className="mono">{count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {kills.length === 0 && !error && (
          <div className="card card-pad muted" style={{ textAlign: "center", padding: 60 }}>
            No unique kills recorded yet.
          </div>
        )}
      </div>
    </Layout>
  );
}
