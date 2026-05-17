// /forum — list of categories with thread/post counts and latest activity
import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import Layout from "@/components/Layout";
import { prisma, serializeServer } from "@/lib/prisma";
import { getCurrentUser, publicUser } from "@/lib/auth";

export async function getServerSideProps({ req, res }) {
  const [user, server, cats] = await Promise.all([
    getCurrentUser(req, res),
    prisma.serverConfig.findUnique({ where: { id: 1 } }),
    prisma.forumCategory.findMany({
      orderBy: { position: "asc" },
      include: {
        _count: { select: { threads: true } },
        threads: {
          orderBy: { updatedAt: "desc" },
          take: 1,
          include: { author: { select: { username: true } } },
        },
      },
    }),
  ]);

  // Aggregate post counts per category
  const withCounts = await Promise.all(
    cats.map(async (c) => {
      const postCount = await prisma.forumPost.count({
        where: { thread: { categoryId: c.id } },
      });
      return {
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description,
        threadCount: c._count.threads,
        postCount,
        latest: c.threads[0]
          ? {
              id: c.threads[0].id,
              title: c.threads[0].title,
              authorName: c.threads[0].author.username,
              updatedAt: c.threads[0].updatedAt.toISOString(),
            }
          : null,
      };
    })
  );

  return {
    props: { user: publicUser(user), server: serializeServer(server), cats: withCounts },
  };
}

export default function ForumIndex({ user, server, cats }) {
  const router = useRouter();
  const [composing, setComposing] = useState(false);
  const [form, setForm] = useState({
    categorySlug: cats[0]?.slug || "",
    title: "",
    body: "",
  });
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
        body: JSON.stringify(form),
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
            <div className="kicker">Community</div>
            <h1 className="page-title">Forum</h1>
            <p className="page-subtitle">
              {cats.length} {cats.length === 1 ? "category" : "categories"} ·{" "}
              {cats.reduce((s, c) => s + c.threadCount, 0)} threads ·{" "}
              {cats.reduce((s, c) => s + c.postCount, 0)} posts
            </p>
          </div>
          {user ? (
            !composing && (
              <button className="btn btn-primary" onClick={() => setComposing(true)}>
                + New thread
              </button>
            )
          ) : (
            <Link href="/login?next=/forum" className="btn btn-secondary">
              Login to post
            </Link>
          )}
        </div>

        {composing && user && (
          <div className="card card-pad" style={{ marginBottom: 20 }}>
            <h2 className="section-title" style={{ marginTop: 0 }}>New Thread</h2>
            {err && <div className="alert alert-error">{err}</div>}
            <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="field">
                <label className="field-label">Category</label>
                <select
                  className="select"
                  value={form.categorySlug}
                  onChange={(e) => setForm({ ...form, categorySlug: e.target.value })}
                  required
                >
                  {cats.map((c) => (
                    <option key={c.slug} value={c.slug}>{c.name}</option>
                  ))}
                </select>
              </div>
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
                <button className="btn btn-primary" disabled={busy || !form.title.trim() || !form.body.trim()}>
                  {busy ? "Posting…" : "Create thread"}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setComposing(false)} disabled={busy}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="card">
          <div className="forum-cat" style={{ background: "var(--bg-2)", cursor: "default" }}>
            <div className="forum-stat-label" style={{ textAlign: "left" }}>Category</div>
            <div className="forum-stat-label">Threads</div>
            <div className="forum-stat-label">Posts</div>
            <div className="forum-stat-label" style={{ textAlign: "left" }}>Latest activity</div>
          </div>
          {cats.map((c) => (
            <Link key={c.id} href={`/forum/c/${c.slug}`} className="forum-cat">
              <div>
                <div className="forum-cat-name">{c.name}</div>
                {c.description && <div className="forum-cat-desc">{c.description}</div>}
              </div>
              <div>
                <div className="forum-stat">{c.threadCount}</div>
              </div>
              <div>
                <div className="forum-stat">{c.postCount}</div>
              </div>
              <div>
                {c.latest ? (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.latest.title}
                    </div>
                    <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                      by {c.latest.authorName} · {new Date(c.latest.updatedAt).toLocaleDateString()}
                    </div>
                  </>
                ) : (
                  <span className="muted" style={{ fontSize: 12 }}>No threads yet</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </Layout>
  );
}
