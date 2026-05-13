// /u/[username] — public user profile + wall posts
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import { prisma, serializeServer } from "@/lib/prisma";
import { getCurrentUser, publicUser } from "@/lib/auth";

export async function getServerSideProps({ req, res, params }) {
  const username = String(params.username);
  const [me, server, profile] = await Promise.all([
    getCurrentUser(req, res),
    prisma.serverConfig.findUnique({ where: { id: 1 } }),
    prisma.user.findUnique({
      where: { username },
      include: {
        profilePostsReceived: {
          orderBy: { createdAt: "desc" },
          take: 50,
          include: { author: { select: { id: true, username: true, role: true } } },
        },
      },
    }),
  ]);

  if (!profile) return { notFound: true };

  return {
    props: {
      user: publicUser(me),
      server: serializeServer(server),
      profile: {
        id: profile.id,
        username: profile.username,
        role: profile.role,
        level: profile.level,
        characterName: profile.characterName,
        characterClass: profile.characterClass,
        bio: profile.bio,
        createdAt: profile.createdAt.toISOString(),
        lastLogin: profile.lastLogin?.toISOString() || null,
        online: profile.online,
        banned: profile.banned,
      },
      initialPosts: profile.profilePostsReceived.map((p) => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
      })),
    },
  };
}

function colorFromName(name) {
  if (!name) return "#5BFF9C";
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 70%, 60%)`;
}

function timeAgo(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60000) return "just now";
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function UserProfile({ user, server, profile, initialPosts }) {
  const router = useRouter();
  const [posts, setPosts] = useState(initialPosts);
  const [newPost, setNewPost] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const isMe = user && user.id === profile.id;

  const submitPost = async (e) => {
    e.preventDefault();
    const body = newPost.trim();
    if (!body) return;
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/profile-posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileUsername: profile.username, body }),
      });
      const data = await r.json();
      if (!r.ok) {
        setErr(data.error || "Failed to post");
      } else {
        setPosts((p) => [data, ...p]);
        setNewPost("");
      }
    } catch {
      setErr("Network error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Layout user={user} server={server}>
      <div className="container page" style={{ maxWidth: 880 }}>
        {/* Profile header card */}
        <div className="card card-pad" style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div
              className="user-avatar user-avatar-lg"
              style={{
                width: 80,
                height: 80,
                fontSize: 32,
                background: colorFromName(profile.username),
              }}
            >
              {profile.username.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div className="row" style={{ gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
                <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>{profile.username}</h1>
                {profile.role === "admin" && <span className="badge badge-accent">Admin</span>}
                {profile.role === "gm" && <span className="badge badge-info">GM</span>}
                {profile.banned && <span className="badge badge-danger">Banned</span>}
                {profile.online && (
                  <span className="row" style={{ gap: 4 }}>
                    <span className="dot dot-online" />
                    <span style={{ fontSize: 12, color: "var(--accent)" }}>Online</span>
                  </span>
                )}
              </div>
              {profile.characterName && (
                <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
                  {profile.characterName} · Lv. {profile.level}
                  {profile.characterClass && ` · ${profile.characterClass}`}
                </div>
              )}
              {profile.bio && (
                <p style={{ color: "var(--ink-2)", fontSize: 14, lineHeight: 1.55, margin: "8px 0" }}>
                  {profile.bio}
                </p>
              )}
              <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                Joined {new Date(profile.createdAt).toLocaleDateString()}
                {profile.lastLogin && (
                  <> · Last seen {timeAgo(profile.lastLogin)}</>
                )}
              </div>
            </div>
            {!isMe && user && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <Link href={`/inbox?with=${profile.id}`} className="btn btn-primary btn-sm">
                  ✉️ Send message
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Wall posts */}
        <div className="page-header">
          <div>
            <h2 className="section-title" style={{ marginBottom: 0 }}>Profile posts</h2>
            <p className="page-subtitle">{posts.length} {posts.length === 1 ? "post" : "posts"}</p>
          </div>
        </div>

        {user ? (
          <form onSubmit={submitPost} className="card card-pad" style={{ marginBottom: 16 }}>
            {err && <div className="alert alert-error">{err}</div>}
            <textarea
              className="textarea"
              rows={3}
              placeholder={
                isMe ? "Post on your own wall…" : `Write something on ${profile.username}'s wall…`
              }
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              maxLength={2000}
            />
            <div className="row" style={{ justifyContent: "flex-end", marginTop: 10 }}>
              <button className="btn btn-primary btn-sm" disabled={busy || !newPost.trim()}>
                {busy ? "Posting…" : "Post"}
              </button>
            </div>
          </form>
        ) : (
          <div className="alert alert-info" style={{ marginBottom: 16 }}>
            <Link href="/login">Login</Link> to post on this wall.
          </div>
        )}

        {posts.length === 0 ? (
          <div className="card card-pad muted" style={{ textAlign: "center", padding: 40 }}>
            No posts on this wall yet.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {posts.map((p) => (
              <article key={p.id} className="card card-pad">
                <div className="row" style={{ gap: 10, marginBottom: 10 }}>
                  <Link
                    href={`/u/${p.author.username}`}
                    className="user-avatar"
                    style={{
                      width: 36,
                      height: 36,
                      background: colorFromName(p.author.username),
                      textDecoration: "none",
                    }}
                  >
                    {p.author.username.charAt(0).toUpperCase()}
                  </Link>
                  <div style={{ flex: 1 }}>
                    <Link
                      href={`/u/${p.author.username}`}
                      style={{ fontWeight: 600, color: "var(--ink-1)", textDecoration: "none" }}
                    >
                      {p.author.username}
                    </Link>
                    {p.author.role === "admin" && (
                      <span className="badge badge-accent" style={{ marginLeft: 6, fontSize: 9 }}>
                        Admin
                      </span>
                    )}
                    <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                      {timeAgo(p.createdAt)}
                    </div>
                  </div>
                </div>
                <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.55, fontSize: 14 }}>
                  {p.body}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
