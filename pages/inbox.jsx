// /inbox — DM list + active conversation pane
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import { prisma, serializeServer } from "@/lib/prisma";
import { getCurrentUser, publicUser } from "@/lib/auth";

export async function getServerSideProps({ req, res }) {
  const user = await getCurrentUser(req, res);
  if (!user) {
    return { redirect: { destination: "/login?next=/inbox", permanent: false } };
  }
  const server = await prisma.serverConfig.findUnique({ where: { id: 1 } });
  return {
    props: { user: publicUser(user), server: serializeServer(server) },
  };
}

function colorFromName(name) {
  if (!name) return "#5BFF9C";
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 70%, 60%)`;
}

function fmtTime(iso) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString();
}

export default function Inbox({ user, server }) {
  const router = useRouter();
  const withId = router.query.with ? parseInt(router.query.with, 10) : null;

  const [conversations, setConversations] = useState([]);
  const [activeMessages, setActiveMessages] = useState([]);
  const [activeOther, setActiveOther] = useState(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const scrollRef = useRef(null);

  // Load conversation list
  async function loadConvs() {
    try {
      const r = await fetch("/api/inbox");
      if (r.ok) {
        const d = await r.json();
        setConversations(d.conversations || []);
      }
    } catch {}
  }
  useEffect(() => {
    loadConvs();
  }, []);

  // Load active conversation
  useEffect(() => {
    if (!withId) {
      setActiveMessages([]);
      setActiveOther(null);
      return;
    }
    (async () => {
      try {
        const r = await fetch(`/api/inbox/conversation?with=${withId}`);
        if (r.ok) {
          const d = await r.json();
          setActiveMessages(d.messages || []);
          setActiveOther(d.otherUser);
          // Refresh conv list since unread counts may have changed
          loadConvs();
        }
      } catch {}
    })();
  }, [withId]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [activeMessages]);

  const send = async (e) => {
    e.preventDefault();
    const body = input.trim();
    if (!body || !withId) return;
    setBusy(true);
    setErr("");
    setInput("");
    try {
      const r = await fetch("/api/inbox/conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId: withId, body }),
      });
      const data = await r.json();
      if (!r.ok) {
        setErr(data.error || "Send failed");
        setInput(body);
      } else {
        setActiveMessages((ms) => [...ms, data]);
        loadConvs();
      }
    } catch {
      setErr("Network error");
      setInput(body);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Layout user={user} server={server}>
      <div className="container page">
        <div className="page-header">
          <div>
            <div className="kicker">Messages</div>
            <h1 className="page-title">Inbox</h1>
            <p className="page-subtitle">
              {conversations.length}{" "}
              {conversations.length === 1 ? "conversation" : "conversations"}
            </p>
          </div>
        </div>

        <div
          className="card"
          style={{
            display: "grid",
            gridTemplateColumns: "320px 1fr",
            minHeight: 520,
          }}
        >
          {/* Conversations list */}
          <div style={{ borderRight: "1px solid var(--line-1)", overflowY: "auto" }}>
            <div className="conv-list">
              {conversations.length === 0 ? (
                <div
                  style={{ padding: 32, textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}
                >
                  No messages yet. Visit a user's profile to start a conversation.
                </div>
              ) : (
                conversations.map((c) => (
                  <Link
                    key={c.otherUser.id}
                    href={`/inbox?with=${c.otherUser.id}`}
                    className={`conv-item ${withId === c.otherUser.id ? "active" : ""}`}
                  >
                    <div
                      className="user-avatar"
                      style={{
                        width: 40,
                        height: 40,
                        fontSize: 15,
                        background: colorFromName(c.otherUser.username),
                      }}
                    >
                      {c.otherUser.username.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        className="row"
                        style={{ justifyContent: "space-between", marginBottom: 2 }}
                      >
                        <span
                          className={c.unreadCount > 0 ? "conv-unread" : ""}
                          style={{ fontWeight: 600, fontSize: 13 }}
                        >
                          {c.otherUser.username}
                        </span>
                        <span className="muted" style={{ fontSize: 10 }}>
                          {fmtTime(c.lastMessage.createdAt)}
                        </span>
                      </div>
                      <div
                        className="muted"
                        style={{
                          fontSize: 12,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {c.lastMessage.fromMe && "You: "}
                        {c.lastMessage.body}
                      </div>
                    </div>
                    {c.unreadCount > 0 && (
                      <span className="badge badge-accent" style={{ fontSize: 10 }}>
                        {c.unreadCount}
                      </span>
                    )}
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* Active conversation */}
          <div style={{ display: "grid", gridTemplateRows: "auto 1fr auto" }}>
            {activeOther ? (
              <>
                <div
                  style={{
                    padding: "14px 20px",
                    borderBottom: "1px solid var(--line-1)",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <div
                    className="user-avatar"
                    style={{
                      width: 36,
                      height: 36,
                      background: colorFromName(activeOther.username),
                    }}
                  >
                    {activeOther.username.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700 }}>{activeOther.username}</div>
                    <Link
                      href={`/u/${activeOther.username}`}
                      className="muted"
                      style={{ fontSize: 11, color: "var(--ink-3)" }}
                    >
                      View profile
                    </Link>
                  </div>
                </div>
                <div
                  ref={scrollRef}
                  style={{
                    overflowY: "auto",
                    padding: 20,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  {activeMessages.map((m) => (
                    <div
                      key={m.id}
                      className={`dm-bubble ${m.fromMe ? "dm-bubble-me" : "dm-bubble-them"}`}
                    >
                      {m.body}
                      <div
                        className="dm-time"
                        style={{ color: m.fromMe ? "rgba(0,0,0,0.5)" : undefined }}
                      >
                        {fmtTime(m.createdAt)}
                      </div>
                    </div>
                  ))}
                  {activeMessages.length === 0 && (
                    <div
                      style={{
                        textAlign: "center",
                        color: "var(--ink-3)",
                        padding: 40,
                        fontSize: 13,
                      }}
                    >
                      No messages yet. Send the first one!
                    </div>
                  )}
                </div>
                <form onSubmit={send} className="chat-input">
                  <input
                    type="text"
                    placeholder={`Message ${activeOther.username}…`}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    maxLength={5000}
                    disabled={busy}
                  />
                  <button className="btn btn-primary" disabled={busy || !input.trim()}>
                    Send
                  </button>
                </form>
              </>
            ) : (
              <div
                style={{
                  display: "grid",
                  placeItems: "center",
                  textAlign: "center",
                  color: "var(--ink-3)",
                  padding: 40,
                }}
              >
                <div>
                  <div style={{ fontSize: 48, marginBottom: 8 }}>📥</div>
                  <div style={{ fontWeight: 600, color: "var(--ink-2)" }}>Select a conversation</div>
                  <div style={{ fontSize: 13, marginTop: 4 }}>
                    Or visit a user's profile to start a new one.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {err && <div className="alert alert-error" style={{ marginTop: 12 }}>{err}</div>}
      </div>
    </Layout>
  );
}
