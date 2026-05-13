// /sox-drops — recent SOX (rare) item drops pulled live from the game DB.
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

  let drops = [];
  let error = null;
  if (enabled) {
    try {
      const rows = await gameDb.recentSoxDrops(100);
      drops = rows.map((r) => ({
        player: r.player,
        item: r.item,
        degree: r.degree,
        rarity: r.rarity,
        droppedAt:
          r.droppedAt instanceof Date
            ? r.droppedAt.toISOString()
            : r.droppedAt
            ? String(r.droppedAt)
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
      drops,
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

// Map common rarity-encoding to a label + CSS color
function rarityLabel(r) {
  if (r === null || r === undefined) return null;
  const s = String(r).toLowerCase();
  if (s.includes("sun") || s === "3") return { label: "Sun", color: "var(--boss)" };
  if (s.includes("moon") || s === "2") return { label: "Moon", color: "var(--unique)" };
  if (s.includes("star") || s === "1") return { label: "Star", color: "var(--rare)" };
  return { label: String(r), color: "var(--ink-2)" };
}

export default function SoxDrops({ user, server, enabled, drops, error }) {
  const topPlayers = {};
  for (const d of drops) topPlayers[d.player] = (topPlayers[d.player] || 0) + 1;
  const luckiest = Object.entries(topPlayers).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <Layout user={user} server={server}>
      <div className="container page">
        <div className="page-header">
          <div>
            <div className="kicker">Live from game database</div>
            <h1 className="page-title">SOX Drop Log</h1>
            <p className="page-subtitle">
              {enabled
                ? `${drops.length} recent rare item drops`
                : "Connect the game DB to see live rare drops"}
            </p>
          </div>
        </div>

        {!enabled && (
          <div className="alert alert-info">
            Your administrator hasn't connected the game database yet. Once connected,
            this page will show rare (Star / Moon / Sun) item drops pulled directly
            from the game's <code>_SoxItemLog</code> table.
          </div>
        )}
        {error && (
          <div className="alert alert-error">
            <b>Couldn't load drops from the game database:</b> {error}
          </div>
        )}

        {enabled && drops.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24 }}>
            <div className="card">
              <table className="table">
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>Item</th>
                    <th>Rarity</th>
                    <th>Degree</th>
                    <th style={{ textAlign: "right" }}>When</th>
                  </tr>
                </thead>
                <tbody>
                  {drops.map((d, i) => {
                    const r = rarityLabel(d.rarity);
                    return (
                      <tr key={i}>
                        <td><b>{d.player}</b></td>
                        <td style={{ color: "var(--gold)" }}>{d.item}</td>
                        <td>
                          {r ? (
                            <span className="badge" style={{ color: r.color, background: "var(--bg-2)" }}>
                              {r.label}
                            </span>
                          ) : <span className="muted">—</span>}
                        </td>
                        <td className="mono">{d.degree ?? "—"}</td>
                        <td className="muted" style={{ textAlign: "right", fontSize: 12 }}>
                          {timeAgo(d.droppedAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="card">
              <div className="card-section">
                <div className="kicker">Luckiest players</div>
              </div>
              {luckiest.length === 0 ? (
                <div className="muted" style={{ padding: 20, textAlign: "center", fontSize: 13 }}>
                  No data
                </div>
              ) : (
                <table className="table">
                  <tbody>
                    {luckiest.map(([name, count]) => (
                      <tr key={name}>
                        <td><b>{name}</b></td>
                        <td style={{ textAlign: "right" }} className="mono">{count} drops</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {enabled && drops.length === 0 && !error && (
          <div className="card card-pad muted" style={{ textAlign: "center", padding: 60 }}>
            No rare drops recorded in the game database yet.
          </div>
        )}
      </div>
    </Layout>
  );
}
