// /chat — global live chat. Polls every 3s for new messages.
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Layout from "@/components/Layout";
import { prisma, serializeServer } from "@/lib/prisma";
import { getCurrentUser, publicUser } from "@/lib/auth";

export async function getServerSideProps({ req, res }) {
  const [user, server, initial] = await Promise.all([
    getCurrentUser(req, res),
    prisma.serverConfig.findUnique({ where: { id: 1 } }),
    prisma.chatMessage.findMany({
      where: { channel: "general" },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        author: { select: { id: true, username: true, role: true } },
      },
    }),
  ]);

  return {
    props: {
      user: publicUser(user),
      server: serializeServer(server),
      initialMessages: initial.reverse().map((m) => ({
        ...m,
        createdAt: m.createdAt.toISOString(),
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

function fmtTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function ChatPage({ user, server, initialMessages }) {
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const scrollRef = useRef(null);
  const lastIdRef = useRef(initialMessages.length ? initialMessages[initialMessages.length - 1].id : 0);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Poll for new messages every 3s
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const r = await fetch("/api/chat/messages?channel=general");
        if (!r.ok) return;
        const data = await r.json();
        if (cancelled) return;
        // Only update if there's actually a new last message
        const newLast = data.messages.length
          ? data.messages[data.messages.length - 1].id
          : 0;
        if (newLast !== lastIdRef.current) {
          lastIdRef.current = newLast;
          setMessages(data.messages);
        }
      } catch {}
    }
    const t = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  const send = async (e) => {
    e.preventDefault();
    const body = input.trim();
    if (!body || !user) return;
    setBusy(true);
    setErr("");
    setInput("");
    try {
      const r = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, channel: "general" }),
      });
      const data = await r.json();
      if (!r.ok) {
        setErr(data.error || "Failed to send");
        setInput(body);
      } else {
        setMessages((ms) => [...ms, data]);
        lastIdRef.current = data.id;
      }
    } catch {
      setErr("Network error");
      setInput(body);
    } finally {
      setBusy(false);
    }
  };

  // Group consecutive messages from the same author
  function shouldGroup(curr, prev) {
    if (!prev) return false;
    if (curr.author.id !== prev.author.id) return false;
    return new Date(curr.createdAt) - new Date(prev.createdAt) < 5 * 60 * 1000;
  }

  return (
    <Layout user={user} server={server}>
      <div className="container page">
        <div className="page-header">
          <div>
            <div className="kicker">Community</div>
            <h1 className="page-title">Live Chat</h1>
            <p className="page-subtitle">
              <span className="dot dot-online" /> #general — talk to everyone on the server
            </p>
          </div>
        </div>

        <div className="chat-shell">
          <div className="chat-messages" ref={scrollRef}>
            {messages.length === 0 ? (
              <div style={{ textAlign: "center", color: "var(--ink-3)", padding: 60 }}>
                No messages yet. Be the first to say something!
              </div>
            ) : (
              messages.map((m, i) => {
                const grouped = shouldGroup(m, messages[i - 1]);
                if (grouped) {
                  return (
                    <div key={m.id} className="chat-message chat-message-grouped">
                      <div className="chat-msg-text">{m.body}</div>
                    </div>
                  );
                }
                return (
                  <div key={m.id} className="chat-message" style={{ marginTop: i > 0 ? 12 : 0 }}>
                    <div
                      className="user-avatar"
                      style={{
                        width: 40,
                        height: 40,
                        fontSize: 16,
                        background: colorFromName(m.author.username),
                      }}
                    >
                      {m.author.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="chat-msg-body">
                      <div className="chat-msg-header">
                        <span
                          className="chat-msg-author"
                          style={{
                            color:
                              m.author.role === "admin"
                                ? "var(--accent)"
                                : m.author.role === "gm"
                                ? "var(--info)"
                                : "var(--ink-1)",
                          }}
                        >
                          {m.author.username}
                        </span>
                        {m.author.role === "admin" && (
                          <span className="badge badge-accent" style={{ fontSize: 9 }}>Admin</span>
                        )}
                        {m.author.role === "gm" && (
                          <span className="badge badge-info" style={{ fontSize: 9 }}>GM</span>
                        )}
                        <span className="chat-msg-time">{fmtTime(m.createdAt)}</span>
                      </div>
                      <div className="chat-msg-text">{m.body}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <form onSubmit={send} className="chat-input">
            {user ? (
              <>
                <input
                  type="text"
                  placeholder={busy ? "Sending…" : `Message #general as ${user.username}`}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  maxLength={1000}
                  disabled={busy}
                />
                <button className="btn btn-primary" disabled={busy || !input.trim()}>
                  Send
                </button>
              </>
            ) : (
              <div style={{ flex: 1, textAlign: "center", color: "var(--ink-3)", padding: 6 }}>
                <Link href="/login?next=/chat">Login</Link> or{" "}
                <Link href="/register">register</Link> to send messages.
              </div>
            )}
          </form>
        </div>

        {err && <div className="alert alert-error" style={{ marginTop: 12 }}>{err}</div>}
      </div>
    </Layout>
  );
}
