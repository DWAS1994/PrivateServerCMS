// /admin — overview dashboard
import Link from "next/link";
import AdminLayout from "@/components/AdminLayout";
import { prisma, serializeServer } from "@/lib/prisma";
import { getCurrentUser, publicUser } from "@/lib/auth";
import { getSafeConfig as getGameDbConfig } from "@/lib/gameDb";

export async function getServerSideProps({ req, res }) {
  const user = await getCurrentUser(req, res);
  if (!user) return { redirect: { destination: "/login?next=/admin", permanent: false } };
  if (user.role !== "admin" && user.role !== "gm") {
    return { redirect: { destination: "/", permanent: false } };
  }

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    server,
    totalUsers,
    onlineUsers,
    bannedUsers,
    newUsers7d,
    totalKills,
    kills24h,
    totalSpawns,
    pendingPayments,
    completedPaymentsAgg,
    revenue30d,
    upcomingEvents,
    recentNews,
  ] = await Promise.all([
    prisma.serverConfig.findUnique({ where: { id: 1 } }),
    prisma.user.count(),
    prisma.user.count({ where: { online: true } }),
    prisma.user.count({ where: { banned: true } }),
    prisma.user.count({ where: { createdAt: { gte: since7d } } }),
    prisma.monsterKill.count(),
    prisma.monsterKill.count({ where: { killedAt: { gte: since24h } } }),
    prisma.monsterSpawn.count(),
    prisma.payment.count({ where: { status: "pending" } }),
    prisma.payment.count({ where: { status: "completed" } }),
    prisma.payment.aggregate({
      where: {
        status: "completed",
        completedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
      _sum: { amount: true },
    }),
    prisma.gameEvent.count({
      where: {
        OR: [{ startsAt: { gte: new Date() } }, { endsAt: { gte: new Date() } }],
      },
    }),
    prisma.newsPost.count(),
  ]);

  // Game DB status — separate try because the call might throw if config is bad
  let gameDbStatus = { enabled: false, ok: null, lastTestedAt: null, error: null };
  try {
    const gc = await getGameDbConfig();
    if (gc) {
      gameDbStatus = {
        enabled: gc.enabled,
        ok: gc.lastTestOk,
        lastTestedAt: gc.lastTestedAt
          ? gc.lastTestedAt.toISOString
            ? gc.lastTestedAt.toISOString()
            : gc.lastTestedAt
          : null,
        error: gc.lastTestError,
      };
    }
  } catch {}

  return {
    props: {
      user: publicUser(user),
      server: serializeServer(server),
      gameDbStatus,
      stats: {
        totalUsers,
        onlineUsers,
        bannedUsers,
        newUsers7d,
        totalKills,
        kills24h,
        totalSpawns,
        pendingPayments,
        completedPayments: completedPaymentsAgg,
        revenue30d: revenue30d._sum.amount || 0,
        upcomingEvents,
        recentNews,
      },
    },
  };
}

export default function AdminDashboard({ user, server, stats, gameDbStatus }) {
  return (
    <AdminLayout user={user} server={server} title="Dashboard">
      {/* Server status card */}
      <div className="card card-pad" style={{ marginBottom: 20 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <div className="kicker">Server status</div>
            <div className="row" style={{ gap: 8, marginTop: 6 }}>
              <span className={`dot ${server?.online ? "dot-online" : "dot-offline"}`} />
              <span style={{ fontSize: 18, fontWeight: 600 }}>
                {server?.online ? "Online" : "Offline"}
              </span>
              <span className="muted" style={{ fontSize: 13 }}>
                · {stats.onlineUsers} / {server?.maxPlayers ?? 0} players
              </span>
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              Registration {server?.registrationOpen ? "open" : "closed"} · PvP{" "}
              {server?.pvpEnabled ? "on" : "off"}
            </div>
          </div>
          <Link href="/admin/settings" className="btn btn-secondary">
            Edit settings →
          </Link>
        </div>
      </div>

      {/* Game DB connection status */}
      <div className="card card-pad" style={{ marginBottom: 20 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <div className="kicker">Game database</div>
            <div className="row" style={{ gap: 8, marginTop: 6 }}>
              <span
                className={`dot ${
                  !gameDbStatus.enabled
                    ? "dot-offline"
                    : gameDbStatus.ok
                    ? "dot-online"
                    : "dot-offline"
                }`}
                style={!gameDbStatus.enabled || !gameDbStatus.ok ? { background: "var(--danger)" } : undefined}
              />
              <span style={{ fontSize: 18, fontWeight: 600 }}>
                {!gameDbStatus.enabled
                  ? "Not connected"
                  : gameDbStatus.ok
                  ? "Connected"
                  : "Connection failing"}
              </span>
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              {gameDbStatus.lastTestedAt
                ? `Last test: ${new Date(gameDbStatus.lastTestedAt).toLocaleString()}`
                : "Never tested"}
              {gameDbStatus.error && (
                <span style={{ color: "var(--danger)", marginLeft: 8 }}>
                  · {gameDbStatus.error}
                </span>
              )}
            </div>
          </div>
          <Link href="/admin/game-db" className="btn btn-secondary">
            {gameDbStatus.enabled ? "Manage connection" : "Connect now"} →
          </Link>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="status-grid" style={{ marginBottom: 20 }}>
        <div className="status-card">
          <div className="status-label">Total accounts</div>
          <div className="status-value">{stats.totalUsers.toLocaleString()}</div>
          <div className="status-sub">+{stats.newUsers7d} this week</div>
        </div>
        <div className="status-card">
          <div className="status-label">Banned</div>
          <div className="status-value" style={{ color: "var(--danger)" }}>
            {stats.bannedUsers}
          </div>
          <div className="status-sub">Inactive accounts</div>
        </div>
        <div className="status-card">
          <div className="status-label">Kills · 24h</div>
          <div className="status-value">{stats.kills24h.toLocaleString()}</div>
          <div className="status-sub">{stats.totalKills.toLocaleString()} total</div>
        </div>
        <div className="status-card">
          <div className="status-label">Revenue · 30d</div>
          <div className="status-value" style={{ color: "var(--gold)" }}>
            ${stats.revenue30d.toFixed(2)}
          </div>
          <div className="status-sub">{stats.completedPayments} payments</div>
        </div>
      </div>

      {/* Mini cards */}
      <div className="status-grid">
        <Link href="/admin/events" style={{ textDecoration: "none" }}>
          <div className="status-card" style={{ cursor: "pointer" }}>
            <div className="status-label">Events</div>
            <div className="status-value">{stats.upcomingEvents}</div>
            <div className="status-sub">Upcoming or live</div>
          </div>
        </Link>
        <Link href="/admin/news" style={{ textDecoration: "none" }}>
          <div className="status-card" style={{ cursor: "pointer" }}>
            <div className="status-label">News</div>
            <div className="status-value">{stats.recentNews}</div>
            <div className="status-sub">Total posts</div>
          </div>
        </Link>
        <Link href="/admin/monsters" style={{ textDecoration: "none" }}>
          <div className="status-card" style={{ cursor: "pointer" }}>
            <div className="status-label">Spawns logged</div>
            <div className="status-value">{stats.totalSpawns.toLocaleString()}</div>
            <div className="status-sub">All-time</div>
          </div>
        </Link>
        <Link href="/admin/payments" style={{ textDecoration: "none" }}>
          <div className="status-card" style={{ cursor: "pointer" }}>
            <div className="status-label">Pending payments</div>
            <div className="status-value" style={{ color: stats.pendingPayments > 0 ? "var(--warn)" : undefined }}>
              {stats.pendingPayments}
            </div>
            <div className="status-sub">Awaiting completion</div>
          </div>
        </Link>
      </div>

      <div className="card card-pad" style={{ marginTop: 24 }}>
        <h3 className="card-title">Quick actions</h3>
        <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          <Link href="/admin/news" className="btn btn-primary">+ New post</Link>
          <Link href="/admin/events" className="btn btn-secondary">+ Schedule event</Link>
          <Link href="/admin/monsters" className="btn btn-secondary">+ Add monster</Link>
          <Link href="/admin/users" className="btn btn-ghost">Manage users</Link>
        </div>
      </div>
    </AdminLayout>
  );
}
