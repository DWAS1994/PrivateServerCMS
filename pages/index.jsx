// Homepage — server status hero, latest news, upcoming events
import Link from "next/link";
import Layout from "@/components/Layout";
import { prisma, serializeServer } from "@/lib/prisma";
import { getCurrentUser, publicUser } from "@/lib/auth";

export async function getServerSideProps({ req, res }) {
  const [user, server, news, events, onlineCount, totalAccounts] =
    await Promise.all([
      getCurrentUser(req, res),
      prisma.serverConfig.findUnique({ where: { id: 1 } }),
      prisma.newsPost.findMany({
        orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
        take: 5,
      }),
      prisma.gameEvent.findMany({
        where: {
          OR: [
            { startsAt: { gte: new Date() } },
            { endsAt: { gte: new Date() } },
          ],
        },
        orderBy: { startsAt: "asc" },
        take: 4,
      }),
      prisma.user.count({ where: { online: true } }),
      prisma.user.count(),
    ]);

  return {
    props: {
      user: publicUser(user),
      server: serializeServer(server),
      news: news.map((n) => ({ ...n, createdAt: n.createdAt.toISOString(), updatedAt: n.updatedAt.toISOString() })),
      events: events.map((e) => ({
        ...e,
        startsAt: e.startsAt.toISOString(),
        endsAt: e.endsAt?.toISOString() || null,
        createdAt: e.createdAt.toISOString(),
      })),
      onlineCount,
      totalAccounts,
      demoMode: process.env.DEMO_MODE === "1",
    },
  };
}

export default function Home({ user, server, news, events, onlineCount, totalAccounts, demoMode }) {
  const serverName = server?.serverName || "MMORPG Server";

  return (
    <Layout user={user} server={server} demoMode={demoMode}>
      {/* Hero */}
      <section className="hero">
        <div className="container hero-inner">
          <div className="kicker" style={{ marginBottom: 14 }}>
            {server?.online ? (
              <>
                <span className="dot dot-online" /> Server online
              </>
            ) : (
              <>
                <span className="dot dot-offline" /> Server offline
              </>
            )}
          </div>
          <h1>
            {serverName}
            <br />
            <span className="accent">{server?.motd || "Begin your adventure."}</span>
          </h1>
          <p>
            High rates, dedicated staff, active community. Register an account, download the
            client, and you'll be in-game in minutes.
          </p>
          <div className="hero-cta">
            {user ? (
              <Link href="/account" className="btn btn-primary btn-lg">
                My Account
              </Link>
            ) : (
              <>
                <Link href="/register" className="btn btn-primary btn-lg">
                  Register Now
                </Link>
                <Link href="/login" className="btn btn-secondary btn-lg">
                  Login
                </Link>
              </>
            )}
            <Link href="/donate" className="btn btn-ghost btn-lg">
              Support the Server
            </Link>
          </div>
        </div>
      </section>

      {/* Status grid */}
      <div className="container" style={{ marginTop: -40, position: "relative", zIndex: 2 }}>
        <div className="status-grid">
          <div className="status-card">
            <div className="status-label">Online players</div>
            <div className="status-value" style={{ color: "var(--accent)" }}>
              {onlineCount}
              <span style={{ fontSize: 16, color: "var(--ink-3)", fontWeight: 400 }}>
                {" / "}{server?.maxPlayers ?? 0}
              </span>
            </div>
            <div className="status-sub">Live count</div>
          </div>
          <div className="status-card">
            <div className="status-label">Total accounts</div>
            <div className="status-value">{totalAccounts.toLocaleString()}</div>
            <div className="status-sub">Registered players</div>
          </div>
          <div className="status-card">
            <div className="status-label">EXP rate</div>
            <div className="status-value">{server?.experienceRate?.toFixed(1) ?? "1.0"}×</div>
            <div className="status-sub">Gold {server?.goldRate?.toFixed(1) ?? "1.0"}× · Drop {server?.dropRate?.toFixed(1) ?? "1.0"}×</div>
          </div>
          <div className="status-card">
            <div className="status-label">PvP</div>
            <div className="status-value" style={{ color: server?.pvpEnabled ? "var(--accent)" : "var(--ink-3)" }}>
              {server?.pvpEnabled ? "Enabled" : "Disabled"}
            </div>
            <div className="status-sub">Open-world combat</div>
          </div>
        </div>
      </div>

      <div className="container page" style={{ marginTop: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24 }}>
          {/* News */}
          <div>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 14 }}>
              <h2 className="section-title" style={{ marginBottom: 0 }}>Latest News</h2>
              <Link href="/news" className="btn btn-ghost btn-sm">View all →</Link>
            </div>
            {news.length === 0 ? (
              <div className="card card-pad muted" style={{ textAlign: "center", padding: 40 }}>
                No news yet.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {news.map((post) => (
                  <article key={post.id} className="card card-pad">
                    <div className="row" style={{ gap: 6, marginBottom: 8 }}>
                      <span className={`badge badge-${post.category === "patch" ? "info" : post.category === "event" ? "gold" : "accent"}`}>
                        {post.category}
                      </span>
                      {post.pinned && <span className="badge badge-warn">Pinned</span>}
                      <span className="muted" style={{ fontSize: 11, marginLeft: "auto" }}>
                        {new Date(post.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <h3 style={{ fontSize: 18, marginBottom: 8 }}>{post.title}</h3>
                    <p style={{ color: "var(--ink-2)", lineHeight: 1.6, fontSize: 14, margin: 0 }}>
                      {post.body.length > 280 ? post.body.slice(0, 280) + "…" : post.body}
                    </p>
                    <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
                      — {post.author}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          {/* Events sidebar */}
          <div>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 14 }}>
              <h2 className="section-title" style={{ marginBottom: 0 }}>Upcoming Events</h2>
              <Link href="/events" className="btn btn-ghost btn-sm">All</Link>
            </div>
            {events.length === 0 ? (
              <div className="card card-pad muted" style={{ textAlign: "center", padding: 24 }}>
                No upcoming events.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {events.map((ev) => {
                  const start = new Date(ev.startsAt);
                  return (
                    <div key={ev.id} className="card card-pad">
                      <div className="kicker" style={{ color: "var(--accent)", marginBottom: 4 }}>
                        {start.toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}{" · "}
                        {start.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                      </div>
                      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{ev.title}</div>
                      <div className="muted" style={{ fontSize: 12, lineHeight: 1.5 }}>
                        {ev.description.length > 100 ? ev.description.slice(0, 100) + "…" : ev.description}
                      </div>
                      {ev.rewards && (
                        <div style={{ marginTop: 8, fontSize: 11, color: "var(--gold)" }}>
                          🎁 {ev.rewards}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Quick links */}
            <div className="card card-pad" style={{ marginTop: 16 }}>
              <div className="kicker" style={{ marginBottom: 10 }}>Quick links</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <Link href="/forum" className="btn btn-ghost btn-sm" style={{ justifyContent: "flex-start" }}>
                  → Visit the forum
                </Link>
                <Link href="/unique-history" className="btn btn-ghost btn-sm" style={{ justifyContent: "flex-start" }}>
                  → Unique history
                </Link>
                <Link href="/sox-drops" className="btn btn-ghost btn-sm" style={{ justifyContent: "flex-start" }}>
                  → SOX drop log
                </Link>
                <Link href="/donate" className="btn btn-ghost btn-sm" style={{ justifyContent: "flex-start" }}>
                  → Support the server
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
