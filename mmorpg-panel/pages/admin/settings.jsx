// /admin/settings — edit server config (max players, MOTD, rates, etc)
import { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { prisma, serializeServer } from "@/lib/prisma";
import { getCurrentUser, publicUser } from "@/lib/auth";

export async function getServerSideProps({ req, res }) {
  const user = await getCurrentUser(req, res);
  if (!user) return { redirect: { destination: "/login", permanent: false } };
  if (user.role !== "admin" && user.role !== "gm") {
    return { redirect: { destination: "/", permanent: false } };
  }
  let server = await prisma.serverConfig.findUnique({ where: { id: 1 } });
  if (!server) {
    server = await prisma.serverConfig.create({ data: { id: 1 } });
  }
  return {
    props: {
      user: publicUser(user),
      server: serializeServer(server),
    },
  };
}

export default function AdminSettings({ user, server }) {
  const [form, setForm] = useState({
    serverName: server.serverName,
    motd: server.motd,
    maxPlayers: server.maxPlayers,
    online: server.online,
    registrationOpen: server.registrationOpen,
    experienceRate: server.experienceRate,
    goldRate: server.goldRate,
    dropRate: server.dropRate,
    pvpEnabled: server.pvpEnabled,
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      const r = await fetch("/api/admin/server-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await r.json();
      if (!r.ok) {
        setMsg({ type: "error", text: data.error || "Update failed." });
      } else {
        setMsg({ type: "success", text: "Settings saved." });
      }
    } catch {
      setMsg({ type: "error", text: "Network error." });
    } finally {
      setBusy(false);
    }
  };

  const set = (k, v) => setForm({ ...form, [k]: v });

  return (
    <AdminLayout user={user} server={form} title="Server Settings">
      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      <form onSubmit={submit} className="card card-pad" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <h2 className="card-title">General</h2>
        <div className="field">
          <label className="field-label">Server name</label>
          <input
            className="input"
            value={form.serverName}
            onChange={(e) => set("serverName", e.target.value)}
            maxLength={100}
            required
          />
        </div>
        <div className="field">
          <label className="field-label">Message of the day (MOTD)</label>
          <textarea
            className="textarea"
            rows={2}
            value={form.motd}
            onChange={(e) => set("motd", e.target.value)}
            maxLength={500}
          />
          <div className="field-hint">Shown on the homepage hero.</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div className="field">
            <label className="field-label">Max players</label>
            <input
              className="input"
              type="number"
              min={1}
              max={100000}
              value={form.maxPlayers}
              onChange={(e) => set("maxPlayers", parseInt(e.target.value, 10) || 1)}
              required
            />
            <div className="field-hint">
              Concurrent connection cap. Enforced by the game server (this UI just records the
              configured value and shows it on /).
            </div>
          </div>
          <div className="field" style={{ justifyContent: "center" }}>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={form.online}
                onChange={(e) => set("online", e.target.checked)}
              />
              Server is online
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={form.registrationOpen}
                onChange={(e) => set("registrationOpen", e.target.checked)}
              />
              Registration is open
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={form.pvpEnabled}
                onChange={(e) => set("pvpEnabled", e.target.checked)}
              />
              PvP enabled
            </label>
          </div>
        </div>

        <h2 className="card-title" style={{ marginTop: 16 }}>Server rates</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          <div className="field">
            <label className="field-label">EXP rate (×)</label>
            <input
              className="input"
              type="number"
              step={0.1}
              min={0.1}
              value={form.experienceRate}
              onChange={(e) => set("experienceRate", parseFloat(e.target.value) || 1)}
            />
          </div>
          <div className="field">
            <label className="field-label">Gold rate (×)</label>
            <input
              className="input"
              type="number"
              step={0.1}
              min={0.1}
              value={form.goldRate}
              onChange={(e) => set("goldRate", parseFloat(e.target.value) || 1)}
            />
          </div>
          <div className="field">
            <label className="field-label">Drop rate (×)</label>
            <input
              className="input"
              type="number"
              step={0.1}
              min={0.1}
              value={form.dropRate}
              onChange={(e) => set("dropRate", parseFloat(e.target.value) || 1)}
            />
          </div>
        </div>

        <div className="row" style={{ gap: 8, marginTop: 8 }}>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Save settings"}
          </button>
        </div>
      </form>
    </AdminLayout>
  );
}
