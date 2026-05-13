// Site-wide layout: top nav + main content + footer.
// Includes:
//   - Brand link (home)
//   - Main nav: News, Forum, Chat, Events, Unique History, SOX Drops, Donate
//   - Notification bell with dropdown panel (recent personal + global notifs + DMs)
//   - User avatar button with radial-glow effect → dropdown (Inbox / Profile / Notifications / Settings / Logout)
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/news", label: "News" },
  { href: "/forum", label: "Forum" },
  { href: "/chat", label: "Live Chat" },
  { href: "/events", label: "Events" },
  { href: "/unique-history", label: "Unique History" },
  { href: "/sox-drops", label: "SOX Drops" },
  { href: "/donate", label: "Donate" },
];

// Color from a string (stable hash → hue) — used to color avatars
function colorFromName(name) {
  if (!name) return "#5BFF9C";
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 60%)`;
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

const TYPE_ICON = {
  forum_reply: "💬",
  payment: "💰",
  gm_message: "🛡️",
  event: "🎉",
  dm: "✉️",
  system: "🔔",
};

export default function Layout({ user, server, demoMode, children }) {
  const router = useRouter();
  const siteName = server?.serverName || process.env.NEXT_PUBLIC_SITE_NAME || "MMORPG Panel";

  // ── State for the two dropdown panels
  const [bellOpen, setBellOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifs, setNotifs] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadDMs, setUnreadDMs] = useState(0);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const bellRef = useRef(null);
  const userMenuRef = useRef(null);

  // Close panels when clicking outside
  useEffect(() => {
    function onDocClick(e) {
      if (bellRef.current && !bellRef.current.contains(e.target)) setBellOpen(false);
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setUserMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Close panels on route change
  useEffect(() => {
    const close = () => {
      setBellOpen(false);
      setUserMenuOpen(false);
    };
    router.events.on("routeChangeStart", close);
    return () => router.events.off("routeChangeStart", close);
  }, [router.events]);

  // Load notifications on mount + every 30s while logged in
  async function loadNotifs() {
    if (!user) return;
    try {
      setLoadingNotifs(true);
      const r = await fetch("/api/notifications");
      if (r.ok) {
        const data = await r.json();
        setNotifs(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
        setUnreadDMs(data.unreadDMs || 0);
      }
    } finally {
      setLoadingNotifs(false);
    }
  }
  useEffect(() => {
    if (!user) return;
    loadNotifs();
    const t = setInterval(loadNotifs, 30000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function markAllRead() {
    if (!user) return;
    await fetch("/api/notifications", { method: "POST" });
    setNotifs((ns) => ns.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }

  async function markOneRead(n) {
    if (n.read) return;
    await fetch(`/api/notifications/${n.id}`, { method: "POST" });
    setNotifs((ns) => ns.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    setUnreadCount((c) => Math.max(0, c - 1));
  }

  const totalUnread = unreadCount + unreadDMs;
  const avatarColor = user ? colorFromName(user.username) : "#5BFF9C";

  return (
    <div className="shell">
      {demoMode && (
        <div
          style={{
            background: "linear-gradient(90deg, var(--accent), #3FE0C5)",
            color: "var(--accent-ink)",
            padding: "8px 16px",
            textAlign: "center",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          🎮 LIVE DEMO — Sign in as <code style={{ background: "rgba(0,0,0,0.15)", padding: "1px 6px", borderRadius: 4, margin: "0 4px" }}>demo_admin / demopass123</code> to try the admin panel. Data resets periodically.
        </div>
      )}
      <header className="topnav">
        <div className="container topnav-inner">
          {/* Brand → home */}
          <Link href="/" className="brand">
            <span className="brand-mark">⚔</span>
            <span>{siteName}</span>
          </Link>

          {/* Main nav */}
          <nav className="topnav-links">
            {NAV.map((item) => {
              const active =
                item.href === "/"
                  ? router.pathname === "/"
                  : router.pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`topnav-link ${active ? "active" : ""}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="topnav-spacer" />

          {/* Right side: bell + user menu OR login/register */}
          <div className="topnav-right">
            {user ? (
              <>
                {(user.role === "admin" || user.role === "gm") && (
                  <Link href="/admin" className="badge badge-accent" style={{ textDecoration: "none" }}>
                    Admin
                  </Link>
                )}

                {/* ── Notification bell ── */}
                <div className="bell-wrap" ref={bellRef}>
                  <button
                    className="icon-btn"
                    aria-label="Notifications"
                    onClick={() => {
                      setBellOpen((o) => !o);
                      setUserMenuOpen(false);
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
                    </svg>
                    {totalUnread > 0 && (
                      <span className="bell-badge">{totalUnread > 99 ? "99+" : totalUnread}</span>
                    )}
                  </button>

                  {bellOpen && (
                    <div className="dropdown-panel bell-panel">
                      <div className="dropdown-header">
                        <span className="dropdown-title">Notifications</span>
                        {unreadCount > 0 && (
                          <button className="dropdown-action" onClick={markAllRead}>
                            Mark all read
                          </button>
                        )}
                      </div>

                      {/* DM badge link */}
                      {unreadDMs > 0 && (
                        <Link href="/inbox" className="dropdown-item dropdown-item-highlight">
                          <span className="dropdown-icon">✉️</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>
                              {unreadDMs} unread {unreadDMs === 1 ? "message" : "messages"}
                            </div>
                            <div className="muted" style={{ fontSize: 11 }}>
                              Open inbox →
                            </div>
                          </div>
                        </Link>
                      )}

                      {loadingNotifs && notifs.length === 0 ? (
                        <div className="dropdown-empty">Loading…</div>
                      ) : notifs.length === 0 ? (
                        <div className="dropdown-empty">
                          You're all caught up. ✨
                        </div>
                      ) : (
                        <div className="dropdown-list">
                          {notifs.slice(0, 12).map((n) => {
                            const inner = (
                              <>
                                <span className="dropdown-icon">
                                  {TYPE_ICON[n.type] || "🔔"}
                                </span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div className="row" style={{ gap: 6 }}>
                                    <span style={{ fontWeight: n.read ? 400 : 600, fontSize: 13, flex: 1 }}>
                                      {n.title}
                                    </span>
                                    {n.global && (
                                      <span className="badge badge-info" style={{ fontSize: 9, padding: "1px 6px" }}>
                                        Global
                                      </span>
                                    )}
                                  </div>
                                  {n.body && (
                                    <div className="muted" style={{ fontSize: 11, marginTop: 2, lineHeight: 1.4 }}>
                                      {n.body.length > 100 ? n.body.slice(0, 100) + "…" : n.body}
                                    </div>
                                  )}
                                  <div className="muted" style={{ fontSize: 10, marginTop: 4 }}>
                                    {timeAgo(n.createdAt)}
                                  </div>
                                </div>
                                {!n.read && !n.global && <span className="dropdown-unread-dot" />}
                              </>
                            );
                            const cls = `dropdown-item ${n.read ? "" : "dropdown-item-unread"}`;
                            return n.link ? (
                              <Link
                                key={n.id}
                                href={n.link}
                                className={cls}
                                onClick={() => markOneRead(n)}
                              >
                                {inner}
                              </Link>
                            ) : (
                              <div
                                key={n.id}
                                className={cls}
                                onClick={() => markOneRead(n)}
                                style={{ cursor: "pointer" }}
                              >
                                {inner}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div className="dropdown-footer">
                        <Link href="/notifications">See all notifications →</Link>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── User avatar button with radial glow ── */}
                <div className="user-menu-wrap" ref={userMenuRef}>
                  <button
                    className="user-trigger"
                    aria-label="User menu"
                    onClick={() => {
                      setUserMenuOpen((o) => !o);
                      setBellOpen(false);
                    }}
                  >
                    <span className="user-glow" />
                    <span
                      className="user-avatar"
                      style={{ background: avatarColor }}
                    >
                      {user.username.charAt(0).toUpperCase()}
                    </span>
                    <div className="user-info">
                      <span className="user-name">{user.username}</span>
                      <span className="user-silver">
                        💰 {user.silver.toLocaleString()}
                      </span>
                    </div>
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="user-chevron"
                      style={{ transform: userMenuOpen ? "rotate(180deg)" : "rotate(0)" }}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  {userMenuOpen && (
                    <div className="dropdown-panel user-panel">
                      <Link href={`/u/${user.username}`} className="user-panel-header">
                        <span
                          className="user-avatar user-avatar-lg"
                          style={{ background: avatarColor }}
                        >
                          {user.username.charAt(0).toUpperCase()}
                        </span>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{user.username}</div>
                          <div className="muted" style={{ fontSize: 11 }}>
                            View your profile →
                          </div>
                        </div>
                      </Link>

                      <div className="dropdown-divider" />

                      <Link href="/inbox" className="dropdown-item">
                        <span className="dropdown-icon">📥</span>
                        <span style={{ flex: 1 }}>Inbox</span>
                        {unreadDMs > 0 && (
                          <span className="badge badge-accent" style={{ fontSize: 10 }}>
                            {unreadDMs}
                          </span>
                        )}
                      </Link>
                      <Link href={`/u/${user.username}`} className="dropdown-item">
                        <span className="dropdown-icon">📝</span>
                        <span style={{ flex: 1 }}>Profile posts</span>
                      </Link>
                      <Link href="/notifications" className="dropdown-item">
                        <span className="dropdown-icon">🔔</span>
                        <span style={{ flex: 1 }}>Notifications</span>
                        {unreadCount > 0 && (
                          <span className="badge badge-accent" style={{ fontSize: 10 }}>
                            {unreadCount}
                          </span>
                        )}
                      </Link>

                      <div className="dropdown-divider" />

                      <Link href="/account" className="dropdown-item">
                        <span className="dropdown-icon">⚙️</span>
                        <span style={{ flex: 1 }}>Account settings</span>
                      </Link>

                      <div className="dropdown-divider" />

                      <form action="/api/auth/logout" method="post" style={{ margin: 0 }}>
                        <button type="submit" className="dropdown-item dropdown-item-danger">
                          <span className="dropdown-icon">🚪</span>
                          <span style={{ flex: 1, textAlign: "left" }}>Logout</span>
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link href="/login" className="btn btn-ghost btn-sm">
                  Login
                </Link>
                <Link href="/register" className="btn btn-primary btn-sm">
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main>{children}</main>

      <footer className="footer">
        <div className="container">
          © {new Date().getFullYear()} {siteName}. All rights reserved.
          {" · "}
          <Link href="/forum" style={{ color: "inherit" }}>Forum</Link>
          {" · "}
          <Link href="/chat" style={{ color: "inherit" }}>Live Chat</Link>
          {" · "}
          <Link href="/donate" style={{ color: "inherit" }}>Donate</Link>
        </div>
      </footer>
    </div>
  );
}
