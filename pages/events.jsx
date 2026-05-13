// /events — upcoming server events
import { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import { prisma, serializeServer } from "@/lib/prisma";
import { getCurrentUser, publicUser } from "@/lib/auth";

export async function getServerSideProps({ req, res }) {
  const [user, server, events, pastEvents] = await Promise.all([
    getCurrentUser(req, res),
    prisma.serverConfig.findUnique({ where: { id: 1 } }),
    prisma.gameEvent.findMany({
      where: {
        OR: [
          { startsAt: { gte: new Date() } },
          { endsAt: { gte: new Date() } },
        ],
      },
      orderBy: { startsAt: "asc" },
    }),
    prisma.gameEvent.findMany({
      where: {
        AND: [
          { startsAt: { lt: new Date() } },
          { OR: [{ endsAt: null }, { endsAt: { lt: new Date() } }] },
        ],
      },
      orderBy: { startsAt: "desc" },
      take: 10,
    }),
  ]);

  const ser = (e) => ({
    ...e,
    startsAt: e.startsAt.toISOString(),
    endsAt: e.endsAt?.toISOString() || null,
    createdAt: e.createdAt.toISOString(),
  });

  return {
    props: {
      user: publicUser(user),
      server: serializeServer(server),
      events: events.map(ser),
      pastEvents: pastEvents.map(ser),
    },
  };
}

// Hook: ticking countdown to a target date. Returns a human-readable string.
function useCountdown(target) {
  const targetMs = target ? new Date(target).getTime() : null;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!targetMs) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [targetMs]);
  if (!targetMs) return null;
  const diff = targetMs - now;
  if (diff <= 0) return "Starting now";
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function EventCard({ ev, past }) {
  const start = new Date(ev.startsAt);
  const end = ev.endsAt ? new Date(ev.endsAt) : null;
  const isLive = start <= new Date() && (!end || end > new Date());
  const countdown = useCountdown(!isLive && !past ? ev.startsAt : null);

  return (
    <div className="card card-pad" style={past ? { opacity: 0.6 } : {}}>
      <div className="row" style={{ gap: 6, marginBottom: 10 }}>
        {isLive && <span className="badge badge-accent">🔴 Live now</span>}
        {countdown && (
          <span className="badge badge-info" style={{ fontFamily: "var(--mono)" }}>
            ⏱ Starts in {countdown}
          </span>
        )}
        {ev.location && <span className="badge">{ev.location}</span>}
      </div>
      <h3 style={{ fontSize: 18, marginBottom: 6 }}>{ev.title}</h3>
      <div className="kicker" style={{ color: "var(--accent)", marginBottom: 12 }}>
        {start.toLocaleString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
        {end && (
          <>
            {" → "}
            {end.toLocaleString(undefined, {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </>
        )}
      </div>
      <p style={{ color: "var(--ink-2)", fontSize: 13, lineHeight: 1.6, margin: 0 }}>
        {ev.description}
      </p>
      {ev.rewards && (
        <div style={{ marginTop: 12, padding: 10, background: "var(--bg-2)", borderRadius: 6, fontSize: 12 }}>
          <span style={{ color: "var(--gold)" }}>🎁 Rewards:</span>{" "}
          <span style={{ color: "var(--ink-2)" }}>{ev.rewards}</span>
        </div>
      )}
    </div>
  );
}

export default function Events({ user, server, events, pastEvents }) {
  return (
    <Layout user={user} server={server}>
      <div className="container page">
        <div className="page-header">
          <div>
            <div className="kicker">Server Events</div>
            <h1 className="page-title">Upcoming & Live Events</h1>
            <p className="page-subtitle">
              {events.length} active or upcoming · {pastEvents.length} recent
            </p>
          </div>
        </div>

        {events.length === 0 ? (
          <div className="card card-pad muted" style={{ textAlign: "center", padding: 60 }}>
            No events scheduled. Check back soon.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
            {events.map((ev) => (
              <EventCard key={ev.id} ev={ev} />
            ))}
          </div>
        )}

        {pastEvents.length > 0 && (
          <>
            <h2 className="section-title" style={{ marginTop: 36 }}>Past Events</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
              {pastEvents.map((ev) => (
                <EventCard key={ev.id} ev={ev} past />
              ))}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
