// /admin/notifications — broadcast global notifications
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

  const [server, globals] = await Promise.all([
    prisma.serverConfig.findUnique({ where: { id: 1 } }),
    prisma.notification.findMany({
      where: { userId: null },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return {
    props: {
      user: publicUser(user),
      server: serializeServer(server),
      globals: globals.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() })),
    },
  };
}

export default function AdminNotifications({ user, server, globals }) {
  const router = useRouter();
  const [form, setForm] = useState({ type: "system", title: "", body: "", link: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await r.json();
      if (!r.ok) {
        setMsg({ type: "error", text: data.error || "Send failed" });
      } else {
        setMsg({ type: "success", text: "Broadcast sent." });
        setForm({ type: "system", title: "", body: "", link: "" });
        router.replace(router.asPath);
      }
    } catch {
      setMsg({ type: "error", text: "Network error" });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    if (!confirm("Remove this global notification?")) return;
    await fetch(`/api/notifications/${id}`, { method: "DELETE" });
    router.replace(router.asPath);
  };

  return (
    <AdminLayout user={user} server={server} title="Broadcast Notifications">
      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      <form
        onSubmit={submit}
        className="card card-pad"
        style={{ marginBottom: 24, display: "flex", flexDirection: "column", gap: 12 }}
      >
        <h3 className="card-title">Send to everyone</h3>
        <div className="field">
          <label className="field-label">Title</label>
          <input
            className="input"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            maxLength={200}
            required
          />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
          <div className="field">
            <label className="field-label">Type</label>
            <select
              className="select"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              <option value="system">System</option>
              <option value="event">Event</option>
              <option value="gm_message">GM message</option>
              <option value="payment">Payment</option>
            </select>
          </div>
          <div className="field">
            <label className="field-label">Link (optional)</label>
            <input
              className="input"
              value={form.link}
              onChange={(e) => setForm({ ...form, link: e.target.value })}
              placeholder="/events"
            />
          </div>
        </div>
        <div className="field">
          <label className="field-label">Body (optional)</label>
          <textarea
            className="textarea"
            rows={3}
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
          />
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Sending…" : "Broadcast to all users"}
          </button>
        </div>
      </form>

      <h3 className="section-title">Recent global notifications</h3>
      {globals.length === 0 ? (
        <div className="card card-pad muted" style={{ textAlign: "center", padding: 40 }}>
          No global notifications yet.
        </div>
      ) : (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Type</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {globals.map((n) => (
                <tr key={n.id}>
                  <td>
                    <b>{n.title}</b>
                    {n.body && (
                      <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                        {n.body.length > 80 ? n.body.slice(0, 80) + "…" : n.body}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className="badge">{n.type}</span>
                  </td>
                  <td className="muted" style={{ fontSize: 12 }}>
                    {new Date(n.createdAt).toLocaleString()}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => remove(n.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  );
}
