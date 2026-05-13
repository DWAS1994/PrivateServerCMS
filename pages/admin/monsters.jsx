// /admin/monsters — CRUD for the monster registry
import { useState } from "react";
import { useRouter } from "next/router";
import AdminLayout from "@/components/AdminLayout";
import { prisma, serializeServer } from "@/lib/prisma";
import { getCurrentUser, publicUser } from "@/lib/auth";

export async function getServerSideProps({ req, res }) {
  const user = await getCurrentUser(req, res);
  if (!user) return { redirect: { destination: "/login", permanent: false } };
  if (user.role !== "admin" && user.role !== "gm") {
    return { redirect: { destination: "/", permanent: false } };
  }

  const [server, monsters] = await Promise.all([
    prisma.serverConfig.findUnique({ where: { id: 1 } }),
    prisma.monster.findMany({
      orderBy: [{ rarity: "desc" }, { level: "desc" }],
      include: { _count: { select: { spawns: true, kills: true } } },
    }),
  ]);

  return {
    props: {
      user: publicUser(user),
      server: serializeServer(server),
      monsters: monsters.map((m) => ({
        ...m,
        spawnCount: m._count.spawns,
        killCount: m._count.kills,
      })),
    },
  };
}

const empty = {
  id: null, name: "", level: 1, rarity: "common",
  zone: "", hp: 1000, spawnRate: 60, description: "",
};

export default function AdminMonsters({ user, server, monsters }) {
  const router = useRouter();
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const url = editing.id ? `/api/monsters/${editing.id}` : "/api/monsters";
      const method = editing.id ? "PUT" : "POST";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing),
      });
      const data = await r.json();
      if (!r.ok) {
        setMsg({ type: "error", text: data.error || "Save failed." });
        setBusy(false);
        return;
      }
      setEditing(null);
      router.replace(router.asPath);
    } catch {
      setMsg({ type: "error", text: "Network error." });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    if (!confirm("Delete this monster? Spawn/kill history will also be removed.")) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/monsters/${id}`, { method: "DELETE" });
      if (!r.ok) {
        const data = await r.json();
        setMsg({ type: "error", text: data.error || "Delete failed." });
      } else {
        router.replace(router.asPath);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminLayout user={user} server={server} title="Monsters">
      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      <div className="row" style={{ justifyContent: "space-between", marginBottom: 16 }}>
        <span className="muted">{monsters.length} monsters in registry</span>
        {!editing && (
          <button className="btn btn-primary" onClick={() => setEditing({ ...empty })}>
            + Add monster
          </button>
        )}
      </div>

      {editing && (
        <form onSubmit={save} className="card card-pad" style={{ marginBottom: 20, display: "flex", flexDirection: "column", gap: 12 }}>
          <h3 className="card-title">{editing.id ? "Edit monster" : "New monster"}</h3>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
            <div className="field">
              <label className="field-label">Name</label>
              <input className="input" value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                maxLength={100} required />
            </div>
            <div className="field">
              <label className="field-label">Level</label>
              <input className="input" type="number" min={1}
                value={editing.level}
                onChange={(e) => setEditing({ ...editing, level: parseInt(e.target.value, 10) || 1 })} />
            </div>
            <div className="field">
              <label className="field-label">Rarity</label>
              <select className="select" value={editing.rarity}
                onChange={(e) => setEditing({ ...editing, rarity: e.target.value })}>
                <option value="common">Common</option>
                <option value="rare">Rare</option>
                <option value="unique">Unique</option>
                <option value="boss">Boss</option>
              </select>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
            <div className="field">
              <label className="field-label">Zone</label>
              <input className="input" value={editing.zone || ""}
                onChange={(e) => setEditing({ ...editing, zone: e.target.value })}
                placeholder="e.g. Volcano Peak" />
            </div>
            <div className="field">
              <label className="field-label">HP</label>
              <input className="input" type="number" min={1}
                value={editing.hp}
                onChange={(e) => setEditing({ ...editing, hp: parseInt(e.target.value, 10) || 1 })} />
            </div>
            <div className="field">
              <label className="field-label">Spawn cooldown (s)</label>
              <input className="input" type="number" min={1}
                value={editing.spawnRate}
                onChange={(e) => setEditing({ ...editing, spawnRate: parseInt(e.target.value, 10) || 1 })} />
            </div>
          </div>
          <div className="field">
            <label className="field-label">Description (optional)</label>
            <textarea className="textarea" rows={3} value={editing.description || ""}
              onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              placeholder="Drops, spawn conditions, lore notes…" />
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)} disabled={busy}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {monsters.length === 0 ? (
        <div className="card card-pad muted" style={{ textAlign: "center", padding: 40 }}>
          No monsters yet. Add some to start tracking spawns and kills.
        </div>
      ) : (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Lv.</th>
                <th>Rarity</th>
                <th>Zone</th>
                <th>HP</th>
                <th style={{ textAlign: "center" }}>Spawns</th>
                <th style={{ textAlign: "center" }}>Kills</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {monsters.map((m) => (
                <tr key={m.id}>
                  <td><b>{m.name}</b></td>
                  <td>{m.level}</td>
                  <td>
                    <span className={`badge badge-${m.rarity}`}>{m.rarity}</span>
                  </td>
                  <td className="muted">{m.zone || "—"}</td>
                  <td className="mono">{m.hp.toLocaleString()}</td>
                  <td className="mono" style={{ textAlign: "center" }}>{m.spawnCount}</td>
                  <td className="mono" style={{ textAlign: "center" }}>{m.killCount}</td>
                  <td style={{ textAlign: "right" }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditing({
                      id: m.id, name: m.name, level: m.level, rarity: m.rarity,
                      zone: m.zone || "", hp: m.hp, spawnRate: m.spawnRate,
                      description: m.description || "",
                    })}>Edit</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => remove(m.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card card-pad" style={{ marginTop: 20 }}>
        <h3 className="card-title">Logging spawns/kills from your game server</h3>
        <p className="muted" style={{ fontSize: 13, marginTop: 8, lineHeight: 1.6 }}>
          POST events from your game server to <code>/api/monsters/log</code> with the
          <code>X-Server-Token</code> header (set <code>GAME_SERVER_TOKEN</code> in <code>.env</code>).
          Body shape:
        </p>
        <pre style={{ background: "var(--bg-2)", padding: 12, borderRadius: 6, overflowX: "auto", fontSize: 12, marginTop: 8 }}>
{`{ "type": "spawn", "monsterName": "Crimson Dragon", "zone": "Volcano Peak" }
{ "type": "kill",  "monsterName": "Crimson Dragon", "killerName": "Hero42" }`}
        </pre>
      </div>
    </AdminLayout>
  );
}
