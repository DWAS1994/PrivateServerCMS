// /notifications — full notifications list (personal + global)
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import { prisma, serializeServer } from "@/lib/prisma";
import { getCurrentUser, publicUser } from "@/lib/auth";

export async function getServerSideProps({ req, res }) {
  const user = await getCurrentUser(req, res);
  if (!user) {
    return { redirect: { destination: "/login?next=/notifications", permanent: false } };
  }

  const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000); // 60 days
  const [server, notifications] = await Promise.all([
    prisma.serverConfig.findUnique({ where: { id: 1 } }),
    prisma.notification.findMany({
      where: {
        OR: [{ userId: user.id }, { userId: null }],
        createdAt: { gte: since },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);

  return {
    props: {
      user: publicUser(user),
      server: serializeServer(server),
      initialNotifs: notifications.map((n) => ({
        ...n,
        global: n.userId === null,
        createdAt: n.createdAt.toISOString(),
      })),
    },
  };
}

const TYPE_ICON = {
  forum_reply: "💬",
  payment: "💰",
  gm_message: "🛡️",
  event: "🎉",
  dm: "✉️",
  system: "🔔",
};

function timeAgo(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60000) return "just now";
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function NotificationsPage({ user, server, initialNotifs }) {
  const router = useRouter();
  const [notifs, setNotifs] = useState(initialNotifs);
  const [filter, setFilter] = useState("all"); // all | unread | global

  async function markAllRead() {
    await fetch("/api/notifications", { method: "POST" });
    setNotifs((ns) => ns.map((n) => (n.global ? n : { ...n, read: true })));
  }

  async function markRead(n) {
    if (n.read) return;
    await fetch(`/api/notifications/${n.id}`, { method: "POST" });
    setNotifs((ns) => ns.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
  }

  const filtered = notifs.filter((n) => {
    if (filter === "unread") return !n.read;
    if (filter === "global") return n.global;
    return true;
  });

  return (
    <Layout user={user} server={server}>
      <div className="container page" style={{ maxWidth: 720 }}>
        <div className="page-header">
          <div>
            <div className="kicker">Activity</div>
            <h1 className="page-title">Notifications</h1>
            <p className="page-subtitle">Last 60 days</p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={markAllRead}>
            Mark all read
          </button>
        </div>

        <div className="row" style={{ gap: 8, marginBottom: 16 }}>
          {[
            ["all", "All"],
            ["unread", "Unread"],
            ["global", "Global"],
          ].map(([k, label]) => (
            <button
              key={k}
              className={`btn btn-sm ${filter === k ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setFilter(k)}
            >
              {label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="card card-pad muted" style={{ textAlign: "center", padding: 60 }}>
            {filter === "unread"
              ? "No unread notifications. ✨"
              : "No notifications yet."}
          </div>
        ) : (
          <div className="card">
            {filtered.map((n) => {
              const inner = (
                <>
                  <span className="dropdown-icon">{TYPE_ICON[n.type] || "🔔"}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="row" style={{ gap: 6 }}>
                      <span style={{ fontWeight: n.read ? 500 : 700, fontSize: 14 }}>
                        {n.title}
                      </span>
                      {n.global && (
                        <span className="badge badge-info" style={{ fontSize: 9 }}>
                          Global
                        </span>
                      )}
                    </div>
                    {n.body && (
                      <div className="muted" style={{ fontSize: 13, marginTop: 4, lineHeight: 1.5 }}>
                        {n.body}
                      </div>
                    )}
                    <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>
                      {timeAgo(n.createdAt)} · {new Date(n.createdAt).toLocaleString()}
                    </div>
                  </div>
                  {!n.read && !n.global && <span className="dropdown-unread-dot" />}
                </>
              );
              const cls = `dropdown-item ${!n.read ? "dropdown-item-unread" : ""}`;
              return n.link ? (
                <Link key={n.id} href={n.link} className={cls} onClick={() => markRead(n)}>
                  {inner}
                </Link>
              ) : (
                <div
                  key={n.id}
                  className={cls}
                  onClick={() => markRead(n)}
                  style={{ cursor: "pointer" }}
                >
                  {inner}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
