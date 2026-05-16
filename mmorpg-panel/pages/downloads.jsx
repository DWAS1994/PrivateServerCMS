// /downloads — public download hub for players.
// Server admin populates this via /admin/downloads. File URLs are external
// (Google Drive, Mega, server's own CDN). Hitting Download bumps a counter
// so admin can see what's actually being downloaded.
import Layout from "@/components/Layout";
import { prisma, serializeServer } from "@/lib/prisma";
import { getCurrentUser, publicUser } from "@/lib/auth";

const CATEGORIES = [
  { slug: "client",   label: "Game Client",  description: "Full client install. Start here if you've never connected before." },
  { slug: "patcher",  label: "Patcher",      description: "Already have the client? Patch up to the latest version." },
  { slug: "tools",    label: "Tools",        description: "Bot detectors, FPS configs, helper apps." },
  { slug: "optional", label: "Optional",     description: "Soundtrack, custom UI skins, extras." },
];

export async function getServerSideProps({ req, res }) {
  const [user, server, items] = await Promise.all([
    getCurrentUser(req, res),
    prisma.serverConfig.findUnique({ where: { id: 1 } }),
    prisma.downloadItem.findMany({
      where: { hidden: false },
      orderBy: [{ featured: "desc" }, { position: "asc" }, { id: "asc" }],
    }),
  ]);

  return {
    props: {
      user: publicUser(user),
      server: serializeServer(server),
      items: items.map((i) => ({
        ...i,
        createdAt: i.createdAt.toISOString(),
        updatedAt: i.updatedAt.toISOString(),
      })),
    },
  };
}

export default function Downloads({ user, server, items }) {
  const featured = items.filter((i) => i.featured);
  const byCategory = (slug) =>
    items.filter((i) => i.category === slug && !i.featured);

  const track = async (id) => {
    // Best-effort: don't block the click waiting for the counter to update
    fetch(`/api/downloads/${id}/track`, { method: "POST" }).catch(() => {});
  };

  const hasAnything = items.length > 0;

  return (
    <Layout user={user} server={server}>
      <div className="container page">
        <div className="page-header">
          <div>
            <div className="kicker">Get the game</div>
            <h1 className="page-title">Downloads</h1>
            <p className="page-subtitle">
              Everything you need to start playing on{" "}
              <b>{server?.serverName || "this server"}</b>.
            </p>
          </div>
        </div>

        {!hasAnything && (
          <div className="card card-pad" style={{ textAlign: "center", padding: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📦</div>
            <h2 style={{ fontSize: 20, marginBottom: 8 }}>No downloads available yet</h2>
            <p className="muted" style={{ fontSize: 14 }}>
              The server administrator hasn't published any downloads. Check back soon.
            </p>
          </div>
        )}

        {/* Featured downloads — promoted to the top */}
        {featured.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 18, marginBottom: 12, color: "var(--accent)" }}>
              ⭐ Featured
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
              {featured.map((item) => (
                <DownloadCard key={item.id} item={item} onTrack={() => track(item.id)} featured />
              ))}
            </div>
          </div>
        )}

        {/* Categorized downloads */}
        {CATEGORIES.map((cat) => {
          const catItems = byCategory(cat.slug);
          if (catItems.length === 0) return null;
          return (
            <section key={cat.slug} style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 18, marginBottom: 4 }}>{cat.label}</h2>
              <p className="muted" style={{ fontSize: 13, marginTop: 0, marginBottom: 14 }}>
                {cat.description}
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
                {catItems.map((item) => (
                  <DownloadCard key={item.id} item={item} onTrack={() => track(item.id)} />
                ))}
              </div>
            </section>
          );
        })}

        {hasAnything && (
          <p className="muted" style={{ fontSize: 12, textAlign: "center", marginTop: 40, lineHeight: 1.6 }}>
            All downloads are hosted externally by the server administrator. Trouble
            with a link? Report it on the forum.
          </p>
        )}
      </div>
    </Layout>
  );
}

function DownloadCard({ item, onTrack, featured }) {
  const hasMirror = !!item.mirrorUrl;
  return (
    <div
      className="card card-pad"
      style={featured ? { border: "1px solid var(--accent)" } : undefined}
    >
      <div className="row" style={{ gap: 10, marginBottom: 8 }}>
        {item.iconEmoji && <span style={{ fontSize: 22 }}>{item.iconEmoji}</span>}
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: 16, margin: 0 }}>{item.title}</h3>
          <div className="row" style={{ gap: 8, marginTop: 4, fontSize: 11, color: "var(--ink-3)" }}>
            {item.version && (
              <span style={{ fontFamily: "var(--mono)" }}>{item.version}</span>
            )}
            {item.fileSize && <span>· {item.fileSize}</span>}
            {item.downloads > 0 && <span>· {item.downloads.toLocaleString()} downloads</span>}
          </div>
        </div>
      </div>

      {item.description && (
        <p style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 0, lineHeight: 1.55 }}>
          {item.description}
        </p>
      )}

      <div className="row" style={{ gap: 8, marginTop: 14 }}>
        <a
          href={item.url}
          className="btn btn-primary"
          style={{ flex: 1 }}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onTrack}
        >
          ⬇ Download
        </a>
        {hasMirror && (
          <a
            href={item.mirrorUrl}
            className="btn btn-secondary"
            target="_blank"
            rel="noopener noreferrer"
            onClick={onTrack}
            title="Alternative mirror"
          >
            Mirror
          </a>
        )}
      </div>
    </div>
  );
}
