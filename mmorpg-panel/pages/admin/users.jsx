// /admin/users — search users, change role, ban/unban, edit silk
import { useState, useEffect } from "react";
import AdminLayout from "@/components/AdminLayout";
import { prisma, serializeServer } from "@/lib/prisma";
import { getCurrentUser, publicUser } from "@/lib/auth";

export async function getServerSideProps({ req, res }) {
  const user = await getCurrentUser(req, res);
  if (!user) return { redirect: { destination: "/login", permanent: false } };
  if (user.role !== "admin" && user.role !== "gm") {
    return { redirect: { destination: "/", permanent: false } };
  }

  const [server, initialUsers] = await Promise.all([
    prisma.serverConfig.findUnique({ where: { id: 1 } }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return {
    props: {
      user: publicUser(user),
      server: serializeServer(server),
      initialUsers: initialUsers.map((u) => ({
        ...publicUser(u),
        createdAt: u.createdAt.toISOString(),
        lastLogin: u.lastLogin?.toISOString() || null,
        vipUntil: u.vipUntil?.toISOString() || null,
      })),
    },
  };
}

export default function AdminUsers({ user, server, initialUsers }) {
  const [users, setUsers] = useState(initialUsers);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  // Search (debounced)
  useEffect(() => {
    const t = setTimeout(async () => {
      if (q.trim() === "") return;
      try {
        const r = await fetch(`/api/admin/users?q=${encodeURIComponent(q)}`);
        if (r.ok) {
          const data = await r.json();
          setUsers(data);
        }
      } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing),
      });
      const data = await r.json();
      if (!r.ok) {
        setMsg({ type: "error", text: data.error || "Update failed." });
        setBusy(false);
        return;
      }
      // Update locally
      setUsers((us) => us.map((u) => (u.id === data.id ? { ...u, ...data } : u)));
      setEditing(null);
      setMsg({ type: "success", text: "User updated." });
    } catch {
      setMsg({ type: "error", text: "Network error." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminLayout user={user} server={server} title="Users">
      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      <div className="row" style={{ marginBottom: 16, gap: 12 }}>
        <input
          className="input"
          placeholder="Search by username or email…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ maxWidth: 320 }}
        />
        <span className="muted">{users.length} {users.length === 1 ? "result" : "results"}</span>
      </div>

      {editing && (
        <form onSubmit={save} className="card card-pad" style={{ marginBottom: 20, display: "flex", flexDirection: "column", gap: 12 }}>
          <h3 className="card-title">Edit {editing.username}</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div className="field">
              <label className="field-label">Role</label>
              <select className="select" value={editing.role}
                onChange={(e) => setEditing({ ...editing, role: e.target.value })}
                disabled={editing.id === user.id}>
                <option value="player">Player</option>
                <option value="gm">Game Master</option>
                <option value="admin">Admin</option>
              </select>
              {editing.id === user.id && (
                <div className="field-hint">You can't change your own role.</div>
              )}
            </div>
            <div className="field">
              <label className="field-label">Silk</label>
              <input className="input" type="number" min={0} value={editing.silk}
                onChange={(e) => setEditing({ ...editing, silk: parseInt(e.target.value, 10) || 0 })} />
            </div>
            <div className="field" style={{ justifyContent: "center" }}>
              <label className="checkbox">
                <input type="checkbox" checked={editing.banned}
                  onChange={(e) => setEditing({ ...editing, banned: e.target.checked })} />
                Banned
              </label>
            </div>
          </div>
          {editing.banned && (
            <div className="field">
              <label className="field-label">Ban reason</label>
              <input className="input" value={editing.banReason || ""}
                onChange={(e) => setEditing({ ...editing, banReason: e.target.value })}
                placeholder="Reason shown to the player on login attempt" />
            </div>
          )}
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)} disabled={busy}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Email</th>
              <th>Role</th>
              <th>Silk</th>
              <th>Joined</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  <b>{u.username}</b>
                  {u.id === user.id && <span className="badge" style={{ marginLeft: 6 }}>You</span>}
                </td>
                <td className="muted">{u.email}</td>
                <td>
                  <span className={`badge badge-${u.role === "admin" ? "accent" : u.role === "gm" ? "info" : ""}`}>
                    {u.role}
                  </span>
                </td>
                <td className="mono">{u.silk.toLocaleString()}</td>
                <td className="muted" style={{ fontSize: 12 }}>
                  {new Date(u.createdAt).toLocaleDateString()}
                </td>
                <td>
                  {u.banned ? (
                    <span className="badge badge-danger">Banned</span>
                  ) : u.online ? (
                    <span className="badge badge-accent">Online</span>
                  ) : (
                    <span className="muted" style={{ fontSize: 12 }}>Offline</span>
                  )}
                </td>
                <td style={{ textAlign: "right" }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditing({
                    id: u.id, username: u.username, role: u.role,
                    banned: u.banned, banReason: u.banReason || "",
                    silk: u.silk,
                  })}>
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && (
          <div className="muted" style={{ textAlign: "center", padding: 40 }}>
            No users found.
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
