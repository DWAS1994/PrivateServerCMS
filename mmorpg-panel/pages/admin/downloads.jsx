// /admin/downloads — manage the public /downloads page entries.
import { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { prisma, serializeServer } from "@/lib/prisma";
import { getCurrentUser, publicUser } from "@/lib/auth";

const CATEGORIES = [
  { slug: "client",   label: "Game Client" },
  { slug: "patcher",  label: "Patcher" },
  { slug: "tools",    label: "Tools" },
  { slug: "optional", label: "Optional" },
];

const EMPTY_FORM = {
  id: null,
  title: "",
  description: "",
  category: "client",
  url: "",
  mirrorUrl: "",
  fileSize: "",
  version: "",
  iconEmoji: "",
  featured: false,
  hidden: false,
  position: 0,
  notes: "",
};

export async function getServerSideProps({ req, res }) {
  const user = await getCurrentUser(req, res);
  if (!user) return { redirect: { destination: "/login", permanent: false } };
  if (user.role !== "admin") return { redirect: { destination: "/", permanent: false } };

  const [server, items] = await Promise.all([
    prisma.serverConfig.findUnique({ where: { id: 1 } }),
    prisma.downloadItem.findMany({
      orderBy: [{ category: "asc" }, { position: "asc" }, { id: "asc" }],
    }),
  ]);

  return {
    props: {
      user: publicUser(user),
      server: serializeServer(server),
      initialItems: items.map((i) => ({
        ...i,
        createdAt: i.createdAt.toISOString(),
        updatedAt: i.updatedAt.toISOString(),
      })),
    },
  };
}

export default function AdminDownloads({ user, server, initialItems }) {
  const [items, setItems] = useState(initialItems);
  const [form, setForm] = useState(EMPTY_FORM);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (k, v) => setForm({ ...form, [k]: v });
  const editing = form.id !== null;

  const reset = () => { setForm(EMPTY_FORM); setMsg(null); };

  const reload = async () => {
    const r = await fetch("/api/admin/downloads");
    if (!r.ok) return;
    const data = await r.json();
    setItems(data.items);
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const method = editing ? "PUT" : "POST";
      const r = await fetch("/api/admin/downloads", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await r.json();
      if (!r.ok) {
        setMsg({ type: "error", text: data.error || "Save failed" });
      } else {
        setMsg({ type: "success", text: editing ? "Updated." : "Created." });
        await reload();
        reset();
      }
    } catch {
      setMsg({ type: "error", text: "Network error" });
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (item) => {
    setForm({
      id: item.id,
      title: item.title || "",
      description: item.description || "",
      category: item.category || "client",
      url: item.url || "",
      mirrorUrl: item.mirrorUrl || "",
      fileSize: item.fileSize || "",
      version: item.version || "",
      iconEmoji: item.iconEmoji || "",
      featured: !!item.featured,
      hidden: !!item.hidden,
      position: item.position || 0,
      notes: item.notes || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const remove = async (item) => {
    if (!confirm(`Delete "${item.title}"? This can't be undone.`)) return;
    setBusy(true);
    try {
      await fetch("/api/admin/downloads", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      });
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const toggleHidden = async (item) => {
    setBusy(true);
    try {
      await fetch("/api/admin/downloads", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, hidden: !item.hidden }),
      });
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const grouped = CATEGORIES.map((c) => ({
    ...c,
    items: items.filter((i) => i.category === c.slug),
  }));

  return (
    <AdminLayout user={user} server={server} title="Downloads">
      <div className="alert alert-info">
        Add entries to the public <a href="/downloads" target="_blank" rel="noreferrer">downloads page</a>. Host
        the actual files externally (Google Drive, Mega, your own CDN) and paste the
        link here. Hitting "Featured" promotes an item to the top of the page.
      </div>

      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      {/* ────────── Form ────────── */}
      <form onSubmit={submit} className="card card-pad" style={{ marginBottom: 24, display: "flex", flexDirection: "column", gap: 12 }}>
        <h2 className="card-title">
          {editing ? `Edit "${form.title || "download"}"` : "Add new download"}
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 130px 130px", gap: 12 }}>
          <div className="field">
            <label className="field-label">Title *</label>
            <input className="input" value={form.title} required maxLength={200}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Phoenix MMORPG — Full Client v1.4.2" />
          </div>
          <div className="field">
            <label className="field-label">Version</label>
            <input className="input" value={form.version} maxLength={32}
              onChange={(e) => set("version", e.target.value)} placeholder="v1.4.2" />
          </div>
          <div className="field">
            <label className="field-label">File size</label>
            <input className="input" value={form.fileSize} maxLength={32}
              onChange={(e) => set("fileSize", e.target.value)} placeholder="2.4 GB" />
          </div>
        </div>

        <div className="field">
          <label className="field-label">Description</label>
          <textarea className="textarea" value={form.description} maxLength={2000} rows={3}
            onChange={(e) => set("description", e.target.value)}
            placeholder="What's in this download? Any setup steps players should know?" />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="field">
            <label className="field-label">Download URL *</label>
            <input className="input" type="url" value={form.url} required
              onChange={(e) => set("url", e.target.value)}
              placeholder="https://mega.nz/file/…" />
          </div>
          <div className="field">
            <label className="field-label">Mirror URL (optional)</label>
            <input className="input" type="url" value={form.mirrorUrl}
              onChange={(e) => set("mirrorUrl", e.target.value)}
              placeholder="https://drive.google.com/…" />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "180px 120px 100px 1fr", gap: 12, alignItems: "end" }}>
          <div className="field">
            <label className="field-label">Category</label>
            <select className="select" value={form.category}
              onChange={(e) => set("category", e.target.value)}>
              {CATEGORIES.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="field-label">Icon (emoji)</label>
            <input className="input" value={form.iconEmoji} maxLength={4}
              onChange={(e) => set("iconEmoji", e.target.value)} placeholder="💾" />
          </div>
          <div className="field">
            <label className="field-label">Sort pos.</label>
            <input className="input" type="number" value={form.position}
              onChange={(e) => set("position", parseInt(e.target.value, 10) || 0)} />
          </div>
          <div className="row" style={{ gap: 14, paddingBottom: 8 }}>
            <label className="checkbox">
              <input type="checkbox" checked={form.featured}
                onChange={(e) => set("featured", e.target.checked)} />
              Featured
            </label>
            <label className="checkbox">
              <input type="checkbox" checked={form.hidden}
                onChange={(e) => set("hidden", e.target.checked)} />
              Hidden
            </label>
          </div>
        </div>

        <div className="field">
          <label className="field-label">Admin notes (not shown publicly)</label>
          <input className="input" value={form.notes} maxLength={1000}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Where is this hosted? Who uploaded it? Anything else?" />
        </div>

        <div className="row" style={{ gap: 8, marginTop: 4 }}>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : editing ? "Save changes" : "Add download"}
          </button>
          {editing && (
            <button type="button" className="btn btn-secondary" onClick={reset} disabled={busy}>
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* ────────── List ────────── */}
      {grouped.map((cat) => (
        <section key={cat.slug} style={{ marginBottom: 28 }}>
          <h3 style={{ fontSize: 16, marginBottom: 10, color: "var(--ink-2)" }}>
            {cat.label} ({cat.items.length})
          </h3>
          {cat.items.length === 0 ? (
            <div className="card card-pad muted" style={{ fontSize: 13, padding: 20 }}>
              No items in this category yet.
            </div>
          ) : (
            <div className="card">
              <table className="table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Version</th>
                    <th>Size</th>
                    <th>Downloads</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {cat.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        {item.iconEmoji && <span style={{ marginRight: 8 }}>{item.iconEmoji}</span>}
                        <b>{item.title}</b>
                      </td>
                      <td className="mono">{item.version || "—"}</td>
                      <td className="muted">{item.fileSize || "—"}</td>
                      <td className="mono">{item.downloads}</td>
                      <td>
                        {item.featured && <span className="badge badge-gold" style={{ marginRight: 4 }}>⭐ Featured</span>}
                        {item.hidden && <span className="badge badge-danger">Hidden</span>}
                      </td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <button className="btn btn-secondary" style={{ height: 28, fontSize: 12, padding: "0 10px", marginRight: 6 }}
                          onClick={() => startEdit(item)} disabled={busy}>
                          Edit
                        </button>
                        <button className="btn btn-secondary" style={{ height: 28, fontSize: 12, padding: "0 10px", marginRight: 6 }}
                          onClick={() => toggleHidden(item)} disabled={busy}>
                          {item.hidden ? "Show" : "Hide"}
                        </button>
                        <button className="btn btn-secondary" style={{ height: 28, fontSize: 12, padding: "0 10px", color: "var(--danger)" }}
                          onClick={() => remove(item)} disabled={busy}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}

      <div className="card card-pad" style={{ marginTop: 20 }}>
        <h3 className="card-title">💡 Tips</h3>
        <ul style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.8 }}>
          <li><b>Where to host:</b> The CMS doesn't host file uploads. Use <a href="https://mega.nz/" target="_blank" rel="noreferrer">Mega</a>, Google Drive, MediaFire, OneDrive, or your own CDN.</li>
          <li><b>Mirrors:</b> If your main host gets blocked in some regions, add a second mirror URL — players see a "Mirror" button next to the primary download.</li>
          <li><b>Sort position:</b> Lower numbers appear first within their category. 0 is the default; bump to 10, 20, 30 etc. to control order.</li>
          <li><b>Counter:</b> The download counter ticks every time a player clicks the button. Don't sweat the exact number — it's a vanity metric for showing activity.</li>
          <li><b>Hidden:</b> Use "Hide" instead of "Delete" if you might bring an item back later. Players don't see hidden items.</li>
        </ul>
      </div>
    </AdminLayout>
  );
}
