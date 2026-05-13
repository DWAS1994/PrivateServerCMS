// /unique-history — recent unique-monster kills pulled live from the game DB.
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
    } catch (e) {
      error = e.message;
    }
  }

  return {
    props: {
      user: publicUser(user),
      server: serializeServer(server),
      enabled,
      kills,
      error,
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

export default function UniqueHistory({ user, server, enabled, kills, error }) {
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
            <h1 className="page-title">Unique History</h1>
            <p className="page-subtitle">
              {enabled
                ? `${kills.length} recent unique kills`
                : "Connect the game DB to see live unique-monster kills"}
            </p>
          </div>
        </div>

        {!enabled && (
          <div className="alert alert-info">
            Your administrator hasn't connected the game database yet, so live data
            isn't available. Once connected, this page will show recent unique-monster
            kills pulled directly from the game's <code>_UniqueKillLog</code> table.
          </div>
        )}
        {error && (
          <div className="alert alert-error">
            <b>Couldn't load kills from the game database:</b> {error}
          </div>
        )}

        {enabled && kills.length > 0 && (
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

        {enabled && kills.length === 0 && !error && (
          <div className="card card-pad muted" style={{ textAlign: "center", padding: 60 }}>
            No unique kills recorded in the game database yet.
          </div>
        )}
      </div>
    </Layout>
  );
}
