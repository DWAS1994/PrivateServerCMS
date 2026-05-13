// /forum/c/[slug] — list threads in a category + new thread composer
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import { prisma, serializeServer } from "@/lib/prisma";
import { getCurrentUser, publicUser } from "@/lib/auth";

export async function getServerSideProps({ req, res, params }) {
  const slug = String(params.slug);
  const [user, server, category] = await Promise.all([
    getCurrentUser(req, res),
    prisma.serverConfig.findUnique({ where: { id: 1 } }),
    prisma.forumCategory.findUnique({
      where: { slug },
      include: {
        threads: {
          orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
          take: 100,
          include: {
            author: { select: { id: true, username: true, role: true } },
            _count: { select: { posts: true } },
          },
        },
      },
    }),
  ]);

  if (!category) {
    return { notFound: true };
  }

  return {
    props: {
      user: publicUser(user),
      server: serializeServer(server),
      category: {
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
      },
      threads: category.threads.map((t) => ({
        id: t.id,
        title: t.title,
        pinned: t.pinned,
        locked: t.locked,
        views: t.views,
        updatedAt: t.updatedAt.toISOString(),
        createdAt: t.createdAt.toISOString(),
        author: t.author,
        replies: t._count.posts - 1,
      })),
    },
  };
}

export default function CategoryPage({ user, server, category, threads }) {
  const router = useRouter();
  const [composing, setComposing] = useState(false);
  const [form, setForm] = useState({ title: "", body: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const r = await fetch("/api/forum/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categorySlug: category.slug,
          title: form.title,
          body: form.body,
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        setErr(data.error || "Failed to create thread.");
        setBusy(false);
        return;
      }
      router.push(`/forum/thread/${data.id}`);
    } catch {
      setErr("Network error.");
      setBusy(false);
    }
  };

  return (
    <Layout user={user} server={server}>
      <div className="container page">
        <div className="page-header">
          <div>
            <div className="kicker">
              <Link href="/forum">Forum</Link> / {category.name}
            </div>
            <h1 className="page-title">{category.name}</h1>
            {category.description && (
              <p className="page-subtitle">{category.description}</p>
            )}
          </div>
          {user && !composing && (
            <button className="btn btn-primary" onClick={() => setComposing(true)}>
              + New thread
            </button>
          )}
        </div>

        {composing && user && (
          <div className="card card-pad" style={{ marginBottom: 20 }}>
            <h2 className="section-title">New Thread</h2>
            {err && <div className="alert alert-error">{err}</div>}
            <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="field">
                <label className="field-label">Title</label>
                <input
                  className="input"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  maxLength={200}
                  required
                  autoFocus
                />
              </div>
              <div className="field">
                <label className="field-label">Body</label>
                <textarea
                  className="textarea"
                  rows={6}
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  required
                />
              </div>
              <div className="row" style={{ gap: 8 }}>
                <button className="btn btn-primary" disabled={busy}>
                  {busy ? "Posting…" : "Post thread"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setComposing(false)}
                  disabled={busy}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {!user && (
          <div className="alert alert-info">
            <Link href="/login">Login</Link> or <Link href="/register">register</Link> to start a thread.
          </div>
        )}

        {threads.length === 0 ? (
          <div className="card card-pad muted" style={{ textAlign: "center", padding: 60 }}>
            No threads yet. Be the first to post!
          </div>
        ) : (
          <div className="card">
            <table className="table">
              <thead>
                <tr>
                  <th>Thread</th>
                  <th style={{ width: 140 }}>Author</th>
                  <th style={{ width: 80, textAlign: "center" }}>Replies</th>
                  <th style={{ width: 80, textAlign: "center" }}>Views</th>
                  <th style={{ width: 140 }}>Last activity</th>
                </tr>
              </thead>
              <tbody>
                {threads.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <div className="row" style={{ gap: 6 }}>
                        {t.pinned && <span className="badge badge-warn">📌</span>}
                        {t.locked && <span className="badge badge-danger">🔒</span>}
                        <Link href={`/forum/thread/${t.id}`} style={{ fontWeight: 600, color: "var(--ink-1)" }}>
                          {t.title}
                        </Link>
                      </div>
                    </td>
                    <td>
                      <span className={t.author.role === "admin" ? "badge badge-accent" : t.author.role === "gm" ? "badge badge-info" : ""}>
                        {t.author.username}
                      </span>
                    </td>
                    <td style={{ textAlign: "center" }} className="mono">{t.replies}</td>
                    <td style={{ textAlign: "center" }} className="mono">{t.views}</td>
                    <td className="muted" style={{ fontSize: 12 }}>
                      {new Date(t.updatedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}
