// /forum/thread/[id] — full thread view + reply form
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import { prisma, serializeServer } from "@/lib/prisma";
import { getCurrentUser, publicUser } from "@/lib/auth";

export async function getServerSideProps({ req, res, params }) {
  const id = parseInt(params.id, 10);
  if (Number.isNaN(id)) return { notFound: true };

  const [user, server, thread] = await Promise.all([
    getCurrentUser(req, res),
    prisma.serverConfig.findUnique({ where: { id: 1 } }),
    prisma.forumThread.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, username: true, role: true } },
        category: { select: { name: true, slug: true } },
        posts: {
          orderBy: { createdAt: "asc" },
          include: {
            author: {
              select: { id: true, username: true, role: true, createdAt: true },
            },
          },
        },
      },
    }),
  ]);

  if (!thread) return { notFound: true };

  // Bump views (fire-and-forget)
  prisma.forumThread
    .update({ where: { id }, data: { views: { increment: 1 } } })
    .catch(() => {});

  return {
    props: {
      user: publicUser(user),
      server: serializeServer(server),
      thread: {
        id: thread.id,
        title: thread.title,
        pinned: thread.pinned,
        locked: thread.locked,
        views: thread.views,
        createdAt: thread.createdAt.toISOString(),
        author: thread.author,
        category: thread.category,
        posts: thread.posts.map((p) => ({
          id: p.id,
          body: p.body,
          createdAt: p.createdAt.toISOString(),
          author: {
            ...p.author,
            createdAt: p.author.createdAt.toISOString(),
          },
        })),
      },
    },
  };
}

export default function ThreadPage({ user, server, thread }) {
  const router = useRouter();
  const [reply, setReply] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const canPost = user && (!thread.locked || user.role === "admin" || user.role === "gm");

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const r = await fetch(`/api/forum/threads/${thread.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: reply }),
      });
      const data = await r.json();
      if (!r.ok) {
        setErr(data.error || "Failed to reply.");
        setBusy(false);
        return;
      }
      // Refresh page to show new post
      router.replace(router.asPath);
      setReply("");
      setBusy(false);
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
              <Link href="/forum">Forum</Link> /{" "}
              <Link href={`/forum/c/${thread.category.slug}`}>{thread.category.name}</Link>
            </div>
            <h1 className="page-title">
              {thread.pinned && <span className="badge badge-warn" style={{ marginRight: 8 }}>📌 Pinned</span>}
              {thread.locked && <span className="badge badge-danger" style={{ marginRight: 8 }}>🔒 Locked</span>}
              {thread.title}
            </h1>
            <p className="page-subtitle">
              {thread.posts.length} {thread.posts.length === 1 ? "post" : "posts"} · {thread.views} views
            </p>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {thread.posts.map((p, i) => (
            <article key={p.id} className="card card-pad">
              <div className="row" style={{ gap: 12, marginBottom: 12 }}>
                <div
                  style={{
                    width: 40, height: 40, borderRadius: "50%",
                    background: "var(--bg-3)", display: "grid", placeItems: "center",
                    fontWeight: 700, color: "var(--ink-2)",
                  }}
                >
                  {p.author.username.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div className="row" style={{ gap: 6 }}>
                    <b>{p.author.username}</b>
                    {p.author.role === "admin" && <span className="badge badge-accent">Admin</span>}
                    {p.author.role === "gm" && <span className="badge badge-info">GM</span>}
                    {i === 0 && <span className="badge">OP</span>}
                  </div>
                  <div className="muted" style={{ fontSize: 11 }}>
                    Joined {new Date(p.author.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {new Date(p.createdAt).toLocaleString()}
                </div>
              </div>
              <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.7, color: "var(--ink-1)" }}>
                {p.body}
              </div>
            </article>
          ))}
        </div>

        {/* Reply form */}
        <div style={{ marginTop: 20 }}>
          {!user ? (
            <div className="alert alert-info">
              <Link href="/login">Login</Link> or <Link href="/register">register</Link> to reply.
            </div>
          ) : !canPost ? (
            <div className="alert alert-error">This thread is locked.</div>
          ) : (
            <div className="card card-pad">
              <h3 className="card-title" style={{ marginBottom: 12 }}>Reply</h3>
              {err && <div className="alert alert-error">{err}</div>}
              <form onSubmit={submit}>
                <textarea
                  className="textarea"
                  rows={5}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Write your reply…"
                  required
                />
                <div style={{ marginTop: 12 }}>
                  <button className="btn btn-primary" disabled={busy || !reply.trim()}>
                    {busy ? "Posting…" : "Post reply"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
