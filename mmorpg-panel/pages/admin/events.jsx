// /admin/events — list / create / edit / delete events
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
  const [server, events] = await Promise.all([
    prisma.serverConfig.findUnique({ where: { id: 1 } }),
    prisma.gameEvent.findMany({ orderBy: { startsAt: "desc" }, take: 100 }),
  ]);
  return {
    props: {
      user: publicUser(user),
      server: serializeServer(server),
      events: events.map((e) => ({
        ...e,
        startsAt: e.startsAt.toISOString(),
        endsAt: e.endsAt?.toISOString() || null,
        createdAt: e.createdAt.toISOString(),
      })),
    },
  };
}

const empty = { id: null, title: "", description: "", startsAt: "", endsAt: "", location: "", rewards: "" };

// Convert ISO date to value for <input type="datetime-local">
function toDtLocal(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 16);
}

export default function AdminEvents({ user, server, events }) {
  const router = useRouter();
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  // Quick-event composer state: name + countdown (value + unit)
  const [quickName, setQuickName] = useState("");
  const [quickAmount, setQuickAmount] = useState(30);
  const [quickUnit, setQuickUnit] = useState("minutes");
  const [quickBusy, setQuickBusy] = useState(false);

  const quickSubmit = async (e) => {
    e.preventDefault();
    if (!quickName.trim()) return;
    setQuickBusy(true);
    setMsg(null);
    try {
      const multipliers = { minutes: 60_000, hours: 3_600_000, days: 86_400_000 };
      const startsAt = new Date(Date.now() + (parseInt(quickAmount, 10) || 0) * multipliers[quickUnit]);
      const r = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: quickName.trim(),
          description: `Quick event scheduled for ${startsAt.toLocaleString()}.`,
          startsAt: startsAt.toISOString(),
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        setMsg({ type: "error", text: data.error || "Quick add failed." });
      } else {
        setMsg({ type: "success", text: `"${quickName}" scheduled.` });
        setQuickName("");
        router.replace(router.asPath);
      }
    } catch {
      setMsg({ type: "error", text: "Network error." });
    } finally {
      setQuickBusy(false);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const url = editing.id ? `/api/events/${editing.id}` : "/api/events";
      const method = editing.id ? "PUT" : "POST";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editing,
          startsAt: editing.startsAt ? new Date(editing.startsAt).toISOString() : null,
          endsAt: editing.endsAt ? new Date(editing.endsAt).toISOString() : null,
        }),
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
    if (!confirm("Delete this event?")) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/events/${id}`, { method: "DELETE" });
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
    <AdminLayout user={user} server={server} title="Events">
      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      {/* Quick event composer — just name + countdown */}
      <form
        onSubmit={quickSubmit}
        className="card card-pad"
        style={{ marginBottom: 20, display: "flex", flexDirection: "column", gap: 12 }}
      >
        <h3 className="card-title">⚡ Quick event</h3>
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>
          Just need to announce something fast? Enter a name and how long until it starts.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 90px 130px auto", gap: 8, alignItems: "end" }}>
          <div className="field">
            <label className="field-label">Event name</label>
            <input
              className="input"
              value={quickName}
              onChange={(e) => setQuickName(e.target.value)}
              placeholder="Boss raid: Crimson Dragon"
              maxLength={200}
              required
            />
          </div>
          <div className="field">
            <label className="field-label">Starts in</label>
            <input
              className="input"
              type="number"
              min={1}
              value={quickAmount}
              onChange={(e) => setQuickAmount(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label className="field-label">&nbsp;</label>
            <select
              className="select"
              value={quickUnit}
              onChange={(e) => setQuickUnit(e.target.value)}
            >
              <option value="minutes">minutes</option>
              <option value="hours">hours</option>
              <option value="days">days</option>
            </select>
          </div>
          <button className="btn btn-primary" disabled={quickBusy || !quickName.trim()}>
            {quickBusy ? "…" : "Schedule"}
          </button>
        </div>
      </form>

      <div className="row" style={{ justifyContent: "space-between", marginBottom: 16 }}>
        <span className="muted">{events.length} events</span>
        {!editing && (
          <button className="btn btn-primary" onClick={() => setEditing({ ...empty })}>
            + Schedule event
          </button>
        )}
      </div>

      {editing && (
        <form onSubmit={save} className="card card-pad" style={{ marginBottom: 20, display: "flex", flexDirection: "column", gap: 12 }}>
          <h3 className="card-title">{editing.id ? "Edit event" : "New event"}</h3>
          <div className="field">
            <label className="field-label">Title</label>
            <input className="input" value={editing.title}
              onChange={(e) => setEditing({ ...editing, title: e.target.value })} maxLength={200} required />
          </div>
          <div className="field">
            <label className="field-label">Description</label>
            <textarea className="textarea" rows={4} value={editing.description}
              onChange={(e) => setEditing({ ...editing, description: e.target.value })} required />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="field">
              <label className="field-label">Starts at</label>
              <input className="input" type="datetime-local" required
                value={editing.startsAt}
                onChange={(e) => setEditing({ ...editing, startsAt: e.target.value })} />
            </div>
            <div className="field">
              <label className="field-label">Ends at (optional)</label>
              <input className="input" type="datetime-local"
                value={editing.endsAt}
                onChange={(e) => setEditing({ ...editing, endsAt: e.target.value })} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="field">
              <label className="field-label">Location (optional)</label>
              <input className="input" value={editing.location || ""}
                onChange={(e) => setEditing({ ...editing, location: e.target.value })}
                placeholder="e.g. Volcano Peak" />
            </div>
            <div className="field">
              <label className="field-label">Rewards (optional)</label>
              <input className="input" value={editing.rewards || ""}
                onChange={(e) => setEditing({ ...editing, rewards: e.target.value })}
                placeholder="e.g. 5x EXP, unique drops" />
            </div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)} disabled={busy}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {events.length === 0 ? (
        <div className="card card-pad muted" style={{ textAlign: "center", padding: 40 }}>
          No events yet.
        </div>
      ) : (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Starts</th>
                <th>Ends</th>
                <th>Location</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => {
                const isPast = e.endsAt
                  ? new Date(e.endsAt) < new Date()
                  : new Date(e.startsAt) < new Date();
                return (
                  <tr key={e.id} style={isPast ? { opacity: 0.6 } : {}}>
                    <td><b>{e.title}</b></td>
                    <td className="muted" style={{ fontSize: 12 }}>
                      {new Date(e.startsAt).toLocaleString()}
                    </td>
                    <td className="muted" style={{ fontSize: 12 }}>
                      {e.endsAt ? new Date(e.endsAt).toLocaleString() : "—"}
                    </td>
                    <td className="muted">{e.location || "—"}</td>
                    <td style={{ textAlign: "right" }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditing({
                        id: e.id, title: e.title, description: e.description,
                        startsAt: toDtLocal(e.startsAt), endsAt: toDtLocal(e.endsAt),
                        location: e.location || "", rewards: e.rewards || "",
                      })}>Edit</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => remove(e.id)}>Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  );
}
