// /sox-drops — recent SOX (rare) item drops.
// Pulls from the game DB when connected; falls back to the panel's local
// SoxDrop table for demo / standalone installs.
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
  let source = "demo";

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
      source = "live";
    } catch (e) {
      error = e.message;
    }
  }

  // Fallback: pull SOX drops from the panel's own demo table.
  if (!enabled || (drops.length === 0 && !error)) {
    const localDrops = await prisma.soxDrop.findMany({
      orderBy: { droppedAt: "desc" },
      take: 100,
    });
    drops = localDrops.map((d) => ({
      player: d.playerName,
      item: d.itemName,
      degree: d.degree,
      rarity: d.rarity,
      droppedAt: d.droppedAt.toISOString(),
    }));
    source = "demo";
  }

  return {
    props: {
      user: publicUser(user),
      server: serializeServer(server),
      enabled,
      drops,
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

// Map common rarity-encoding to a label + CSS color
function rarityLabel(r) {
  if (r === null || r === undefined) return null;
  const s = String(r).toLowerCase();
  if (s.includes("sun") || s === "3") return { label: "Sun", color: "var(--boss)" };
  if (s.includes("moon") || s === "2") return { label: "Moon", color: "var(--unique)" };
  if (s.includes("star") || s === "1") return { label: "Star", color: "var(--rare)" };
  return { label: String(r), color: "var(--ink-2)" };
}

export default function SoxDrops({ user, server, enabled, drops, error, source }) {
  const topPlayers = {};
  for (const d of drops) topPlayers[d.player] = (topPlayers[d.player] || 0) + 1;
  const luckiest = Object.entries(topPlayers).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <Layout user={user} server={server}>
      <div className="container page">
        <div className="page-header">
          <div>
            <div className="kicker">Live from game database</div>
            <div className="kicker">
              {source === "live" ? "Live from game database" : "Demo data"}
            </div>
            <h1 className="page-title">SOX Drop Log</h1>
            <p className="page-subtitle">
              {drops.length} recent rare item drops
            </p>
          </div>
        </div>

        {error && (
          <div className="alert alert-error">
            <b>Couldn't load drops from the game database:</b> {error}
          </div>
        )}

        {drops.length > 0 && (
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

        {drops.length === 0 && !error && (
          <div className="card card-pad muted" style={{ textAlign: "center", padding: 60 }}>
            No rare drops recorded yet.
          </div>
        )}
      </div>
    </Layout>
  );
}
