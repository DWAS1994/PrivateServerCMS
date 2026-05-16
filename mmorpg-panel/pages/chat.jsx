// /chat — Discord-style live chat.
//
// Layout:
//   ┌────────┬─────────────────────────┬─────────────┐
//   │ chans  │ #channel header         │   Members   │
//   │ #gen   │ ─────────────────────── │   Admin     │
//   │ #...   │ messages (scroll)       │   GMs       │
//   │        │ ─────────────────────── │   Players   │
//   │        │ [type a message…  Send] │             │
//   └────────┴─────────────────────────┴─────────────┘
//
// Admins/GMs see hover-overlay moderation controls on each message:
// delete · mute author · ban author.
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Layout from "@/components/Layout";
import { prisma, serializeServer } from "@/lib/prisma";
import { getCurrentUser, publicUser } from "@/lib/auth";

// Channels available in the demo. To add a new channel, drop a row in here
// — there's nothing in the DB tying messages to specific channels other than
// the `channel` string column on ChatMessage.
const CHANNELS = [
  { slug: "general", name: "general", description: "Main hangout — anything goes" },
  { slug: "trade", name: "trade", description: "WTS / WTB / WTT" },
  { slug: "lfg", name: "lfg", description: "Looking for group" },
  { slug: "off-topic", name: "off-topic", description: "Not about the server" },
];

export async function getServerSideProps({ req, res }) {
  const [user, server, initial, recentChatters] = await Promise.all([
    getCurrentUser(req, res),
    prisma.serverConfig.findUnique({ where: { id: 1 } }),
    prisma.chatMessage.findMany({
      where: { channel: "general", deleted: false },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        author: { select: { id: true, username: true, role: true } },
      },
    }),
    // Member list: anyone who's chatted in the last 24h.
    prisma.user.findMany({
      where: {
        chatMessages: {
          some: { createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        },
      },
      select: { id: true, username: true, role: true, online: true },
      take: 100,
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
      recentChatters,
    },
  };
}

function colorFromName(name) {
  if (!name) return "#E8B547";
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 65%, 55%)`;
}

function fmtTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtDay(iso) {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date(today); y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}

function roleColor(role) {
  if (role === "admin") return "var(--accent)";
  if (role === "gm") return "var(--info)";
  return "var(--ink-1)";
}

export default function ChatPage({ user, server, initialMessages, recentChatters }) {
  const [channel, setChannel] = useState("general");
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [modTarget, setModTarget] = useState(null); // user being acted on (mute modal)
  const scrollRef = useRef(null);
  const lastIdRef = useRef(initialMessages.length ? initialMessages[initialMessages.length - 1].id : 0);

  const isMod = user?.role === "admin" || user?.role === "gm";
  const isAdmin = user?.role === "admin";
  const currentChannel = CHANNELS.find((c) => c.slug === channel) || CHANNELS[0];

  // Auto-scroll to bottom on new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Reload messages when channel changes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/chat/messages?channel=${channel}`);
        if (!r.ok) return;
        const data = await r.json();
        if (cancelled) return;
        setMessages(data.messages);
        lastIdRef.current = data.messages.length
          ? data.messages[data.messages.length - 1].id
          : 0;
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [channel]);

  // Poll for new messages every 3s
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const r = await fetch(`/api/chat/messages?channel=${channel}`);
        if (!r.ok) return;
        const data = await r.json();
        if (cancelled) return;
        const newLast = data.messages.length ? data.messages[data.messages.length - 1].id : 0;
        if (newLast !== lastIdRef.current || data.messages.length !== messages.length) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel]);

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
        body: JSON.stringify({ body, channel }),
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

  const deleteMessage = async (id) => {
    if (!confirm("Delete this message?")) return;
    const r = await fetch(`/api/chat/messages/${id}`, { method: "DELETE" });
    if (r.ok) {
      setMessages((ms) => ms.filter((m) => m.id !== id));
    }
  };

  const moderate = async (action, userId, opts = {}) => {
    const r = await fetch("/api/chat/moderate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, action, ...opts }),
    });
    const data = await r.json();
    if (!r.ok) {
      alert(data.error || "Failed");
      return false;
    }
    return true;
  };

  // Group consecutive messages from the same author within 5 minutes
  function shouldGroup(curr, prev) {
    if (!prev) return false;
    if (curr.author.id !== prev.author.id) return false;
    return new Date(curr.createdAt) - new Date(prev.createdAt) < 5 * 60 * 1000;
  }
  // Show day divider when the date changes between messages
  function shouldShowDayDivider(curr, prev) {
    if (!prev) return true;
    return new Date(curr.createdAt).toDateString() !== new Date(prev.createdAt).toDateString();
  }

  // Group members by role for the right sidebar
  const admins = recentChatters.filter((u) => u.role === "admin");
  const gms = recentChatters.filter((u) => u.role === "gm");
  const players = recentChatters.filter((u) => u.role === "player");

  return (
    <Layout user={user} server={server}>
      <div className="chat-discord-shell">
        {/* ────────── LEFT: channel list ────────── */}
        <aside className="chat-sidebar-left">
          <div className="chat-sidebar-header">
            <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 15 }}>
              {server?.serverName || "Live Chat"}
            </div>
          </div>
          <div className="chat-channel-section">
            <div className="chat-section-label">TEXT CHANNELS</div>
            {CHANNELS.map((c) => (
              <button
                key={c.slug}
                className={`chat-channel-item ${channel === c.slug ? "active" : ""}`}
                onClick={() => setChannel(c.slug)}
                title={c.description}
              >
                <span className="chat-channel-hash">#</span>
                <span>{c.name}</span>
              </button>
            ))}
          </div>
        </aside>

        {/* ────────── CENTER: messages ────────── */}
        <main className="chat-main">
          <header className="chat-channel-header">
            <span className="chat-channel-hash">#</span>
            <b>{currentChannel.name}</b>
            <span className="chat-channel-desc">{currentChannel.description}</span>
          </header>

          <div className="chat-discord-messages" ref={scrollRef}>
            {messages.length === 0 ? (
              <div style={{ textAlign: "center", color: "var(--ink-3)", padding: 60 }}>
                Welcome to <b>#{currentChannel.name}</b>! No messages yet.
              </div>
            ) : (
              messages.map((m, i) => {
                const prev = messages[i - 1];
                const dayDivider = shouldShowDayDivider(m, prev);
                const grouped = !dayDivider && shouldGroup(m, prev);
                return (
                  <div key={m.id}>
                    {dayDivider && (
                      <div className="chat-day-divider">
                        <span>{fmtDay(m.createdAt)}</span>
                      </div>
                    )}
                    <div className={`chat-discord-message ${grouped ? "grouped" : ""}`}>
                      {grouped ? (
                        <span className="chat-msg-timestamp-hover">{fmtTime(m.createdAt)}</span>
                      ) : (
                        <div
                          className="chat-avatar"
                          style={{ background: colorFromName(m.author.username) }}
                        >
                          {m.author.username.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="chat-msg-content">
                        {!grouped && (
                          <div className="chat-msg-meta">
                            <Link
                              href={`/u/${m.author.username}`}
                              className="chat-msg-author-name"
                              style={{ color: roleColor(m.author.role) }}
                            >
                              {m.author.username}
                            </Link>
                            {m.author.role === "admin" && <span className="chat-tag admin">ADMIN</span>}
                            {m.author.role === "gm" && <span className="chat-tag gm">GM</span>}
                            <span className="chat-msg-time">{fmtTime(m.createdAt)}</span>
                          </div>
                        )}
                        <div className="chat-msg-text">{m.body}</div>
                      </div>

                      {/* Hover-only mod controls — admins/GMs see them on every message */}
                      {isMod && m.author.id !== user?.id && (
                        <div className="chat-mod-controls">
                          <button
                            className="chat-mod-btn"
                            title="Delete message"
                            onClick={() => deleteMessage(m.id)}
                          >🗑</button>
                          <button
                            className="chat-mod-btn"
                            title="Mute author"
                            onClick={() => setModTarget({ ...m.author, action: "mute" })}
                          >🔇</button>
                          {isAdmin && m.author.role === "player" && (
                            <button
                              className="chat-mod-btn"
                              title="Ban author"
                              onClick={async () => {
                                const reason = prompt(`Ban ${m.author.username}? Reason:`);
                                if (reason === null) return;
                                const ok = await moderate("ban", m.author.id, { reason });
                                if (ok) alert(`${m.author.username} banned.`);
                              }}
                            >⛔</button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <form onSubmit={send} className="chat-discord-input">
            {user ? (
              <>
                <input
                  type="text"
                  placeholder={busy ? "Sending…" : `Message #${currentChannel.name}`}
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
          {err && <div className="alert alert-error" style={{ margin: "8px 16px" }}>{err}</div>}
        </main>

        {/* ────────── RIGHT: member list ────────── */}
        <aside className="chat-sidebar-right">
          <div className="chat-sidebar-header">
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-3)", letterSpacing: "0.08em" }}>
              ACTIVE — {recentChatters.length}
            </div>
          </div>
          {admins.length > 0 && (
            <div className="chat-member-section">
              <div className="chat-section-label">ADMINS — {admins.length}</div>
              {admins.map((u) => <MemberRow key={u.id} u={u} />)}
            </div>
          )}
          {gms.length > 0 && (
            <div className="chat-member-section">
              <div className="chat-section-label">GAME MASTERS — {gms.length}</div>
              {gms.map((u) => <MemberRow key={u.id} u={u} />)}
            </div>
          )}
          {players.length > 0 && (
            <div className="chat-member-section">
              <div className="chat-section-label">PLAYERS — {players.length}</div>
              {players.map((u) => <MemberRow key={u.id} u={u} />)}
            </div>
          )}
        </aside>
      </div>

      {modTarget && (
        <MuteModal
          target={modTarget}
          onClose={() => setModTarget(null)}
          onConfirm={async (minutes, reason) => {
            const ok = await moderate("mute", modTarget.id, { minutes, reason });
            if (ok) {
              alert(`${modTarget.username} muted for ${minutes} minutes.`);
              setModTarget(null);
            }
          }}
        />
      )}
    </Layout>
  );
}

function MemberRow({ u }) {
  return (
    <Link href={`/u/${u.username}`} className="chat-member-row">
      <div
        className="chat-member-avatar"
        style={{ background: colorFromName(u.username) }}
      >
        {u.username.charAt(0).toUpperCase()}
      </div>
      <span style={{ color: roleColor(u.role) }}>{u.username}</span>
    </Link>
  );
}

function MuteModal({ target, onClose, onConfirm }) {
  const [minutes, setMinutes] = useState(10);
  const [reason, setReason] = useState("");
  return (
    <div className="chat-modal-backdrop" onClick={onClose}>
      <div className="chat-modal" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Mute {target.username}</h3>
        <p className="muted" style={{ fontSize: 13 }}>
          They won't be able to send messages until the mute expires.
        </p>
        <div className="field" style={{ marginTop: 12 }}>
          <label className="field-label">Duration (minutes)</label>
          <select
            className="select"
            value={minutes}
            onChange={(e) => setMinutes(parseInt(e.target.value, 10))}
          >
            <option value={5}>5 minutes</option>
            <option value={10}>10 minutes</option>
            <option value={30}>30 minutes</option>
            <option value={60}>1 hour</option>
            <option value={360}>6 hours</option>
            <option value={1440}>1 day</option>
            <option value={10080}>1 week</option>
          </select>
        </div>
        <div className="field" style={{ marginTop: 12 }}>
          <label className="field-label">Reason (optional)</label>
          <input
            className="input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Spam, harassment, etc."
            maxLength={200}
          />
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onConfirm(minutes, reason)}>
            Mute
          </button>
        </div>
      </div>
    </div>
  );
}
