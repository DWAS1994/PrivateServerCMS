// /admin/news — list / create / edit / delete news posts
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

  const [server, posts] = await Promise.all([
    prisma.serverConfig.findUnique({ where: { id: 1 } }),
    prisma.newsPost.findMany({
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      take: 100,
    }),
  ]);

  return {
    props: {
      user: publicUser(user),
      server: serializeServer(server),
      posts: posts.map((p) => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      })),
    },
  };
}

const empty = { id: null, title: "", body: "", category: "announcement", pinned: false };

export default function AdminNews({ user, server, posts }) {
  const router = useRouter();
  const [editing, setEditing] = useState(null); // null | empty-like obj
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const save = async (e) => {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      const url = editing.id ? `/api/news/${editing.id}` : "/api/news";
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
    if (!confirm("Delete this post?")) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/news/${id}`, { method: "DELETE" });
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
    <AdminLayout user={user} server={server} title="News">
      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      <div className="row" style={{ justifyContent: "space-between", marginBottom: 16 }}>
        <span className="muted">{posts.length} posts</span>
        {!editing && (
          <button className="btn btn-primary" onClick={() => setEditing({ ...empty })}>
            + New post
          </button>
        )}
      </div>

      {editing && (
        <form onSubmit={save} className="card card-pad" style={{ marginBottom: 20, display: "flex", flexDirection: "column", gap: 12 }}>
          <h3 className="card-title">{editing.id ? "Edit post" : "New post"}</h3>
          <div className="field">
            <label className="field-label">Title</label>
            <input
              className="input"
              value={editing.title}
              onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              maxLength={200}
              required
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="field">
              <label className="field-label">Category</label>
              <select
                className="select"
                value={editing.category}
                onChange={(e) => setEditing({ ...editing, category: e.target.value })}
              >
                <option value="announcement">Announcement</option>
                <option value="patch">Patch notes</option>
                <option value="event">Event</option>
              </select>
            </div>
            <div className="field" style={{ justifyContent: "flex-end" }}>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={editing.pinned}
                  onChange={(e) => setEditing({ ...editing, pinned: e.target.checked })}
                />
                Pin to top
              </label>
            </div>
          </div>
          <div className="field">
            <label className="field-label">Body</label>
            <textarea
              className="textarea"
              rows={8}
              value={editing.body}
              onChange={(e) => setEditing({ ...editing, body: e.target.value })}
              required
            />
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-primary" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)} disabled={busy}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {posts.length === 0 ? (
        <div className="card card-pad muted" style={{ textAlign: "center", padding: 40 }}>
          No posts yet.
        </div>
      ) : (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Category</th>
                <th>Author</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {posts.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.pinned && <span className="badge badge-warn">📌</span>}{" "}
                    <b>{p.title}</b>
                  </td>
                  <td>
                    <span className={`badge badge-${
                      p.category === "patch" ? "info" :
                      p.category === "event" ? "gold" : "accent"
                    }`}>{p.category}</span>
                  </td>
                  <td className="muted">{p.author}</td>
                  <td className="muted">{new Date(p.createdAt).toLocaleDateString()}</td>
                  <td style={{ textAlign: "right" }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setEditing({
                        id: p.id, title: p.title, body: p.body,
                        category: p.category, pinned: p.pinned,
                      })}
                    >
                      Edit
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => remove(p.id)}>
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
