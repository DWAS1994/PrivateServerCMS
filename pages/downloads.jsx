// /downloads — focused client-download page.
// Picks the first non-hidden item in the "client" category (preferring
// featured) and shows it as the hero download. Other items in the admin's
// catalog still exist and can be re-promoted later, but this page only
// shows the client.
import { Fragment } from "react";
import Layout from "@/components/Layout";
import { prisma, serializeServer } from "@/lib/prisma";
import { getCurrentUser, publicUser } from "@/lib/auth";

export async function getServerSideProps({ req, res }) {
  const [user, server, client] = await Promise.all([
    getCurrentUser(req, res),
    prisma.serverConfig.findUnique({ where: { id: 1 } }),
    prisma.downloadItem.findFirst({
      where: { hidden: false, category: "client" },
      orderBy: [{ featured: "desc" }, { position: "asc" }, { id: "asc" }],
    }),
  ]);

  return {
    props: {
      user: publicUser(user),
      server: serializeServer(server),
      client: client
        ? {
            id: client.id,
            title: client.title,
            description: client.description,
            url: client.url,
            mirrorUrl: client.mirrorUrl,
            fileSize: client.fileSize,
            version: client.version,
            downloads: client.downloads,
            updatedAt: client.updatedAt.toISOString(),
          }
        : null,
    },
  };
}

// Recommended-specs line: hard-coded for now. Admins can edit this constant
// or wire it to ServerConfig if they want it dynamic.
const SPECS = [
  { label: "OS",       value: "Windows 10 / 11 (64-bit)" },
  { label: "CPU",      value: "Quad-core 2.5 GHz or better" },
  { label: "RAM",      value: "8 GB" },
  { label: "GPU",      value: "GTX 1050 / RX 560 or better" },
  { label: "Storage",  value: "5 GB free" },
];

const STEPS = [
  "Download the client using the button above.",
  "Unzip the archive to a folder of your choice (somewhere outside Program Files works best).",
  "Run sro_client.exe — the launcher will check for any small patches automatically.",
  "Create an account on this site if you haven't already, then log in using the same credentials in-game.",
];

export default function Downloads({ user, server, client }) {
  const track = () => {
    if (!client) return;
    fetch(`/api/downloads/${client.id}/track`, { method: "POST" }).catch(() => {});
  };

  return (
    <Layout user={user} server={server}>
      <div className="container page" style={{ maxWidth: 820 }}>
        <div className="page-header">
          <div>
            <div className="kicker">Get the game</div>
            <h1 className="page-title">Download Client</h1>
            <p className="page-subtitle">
              Everything you need to start playing on{" "}
              <b>{server?.serverName || "this server"}</b>.
            </p>
          </div>
        </div>

        {!client ? (
          <div className="card card-pad" style={{ textAlign: "center", padding: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📦</div>
            <h2 style={{ fontSize: 20, marginBottom: 8 }}>Client coming soon</h2>
            <p className="muted" style={{ fontSize: 14 }}>
              The server administrator hasn't published the client download yet.
              Check back shortly — or follow announcements on the{" "}
              <a href="/news">news page</a>.
            </p>
          </div>
        ) : (
          <>
            {/* Hero download card */}
            <div className="card card-pad" style={{ borderColor: "var(--accent)", padding: 32 }}>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
                <div style={{ flex: "1 1 320px" }}>
                  <h2 style={{ fontSize: 22, margin: 0 }}>{client.title}</h2>
                  <div className="row" style={{ gap: 10, marginTop: 8, fontSize: 12, color: "var(--ink-3)" }}>
                    {client.version && (
                      <span style={{ fontFamily: "var(--mono)" }}>{client.version}</span>
                    )}
                    {client.version && (client.fileSize || client.downloads > 0) && <span>·</span>}
                    {client.fileSize && <span>{client.fileSize}</span>}
                    {client.fileSize && client.downloads > 0 && <span>·</span>}
                    {client.downloads > 0 && (
                      <span>{client.downloads.toLocaleString()} downloads</span>
                    )}
                  </div>
                </div>

                <div className="row" style={{ gap: 8, flex: "0 1 auto" }}>
                  <a
                    href={client.url}
                    className="btn btn-primary"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={track}
                    style={{ height: 48, padding: "0 22px", fontSize: 14 }}
                  >
                    ⬇ Download
                  </a>
                  {client.mirrorUrl && (
                    <a
                      href={client.mirrorUrl}
                      className="btn btn-secondary"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={track}
                      style={{ height: 48, padding: "0 16px" }}
                      title="Alternative mirror"
                    >
                      Mirror
                    </a>
                  )}
                </div>
              </div>

              {client.description && (
                <p style={{ fontSize: 14, color: "var(--ink-2)", lineHeight: 1.6, marginTop: 20, marginBottom: 0 }}>
                  {client.description}
                </p>
              )}
            </div>

            {/* Setup steps */}
            <div className="card card-pad" style={{ marginTop: 24 }}>
              <h3 style={{ fontSize: 16, marginTop: 0 }}>How to install</h3>
              <ol style={{ paddingLeft: 22, color: "var(--ink-2)", lineHeight: 1.8, margin: 0 }}>
                {STEPS.map((step, i) => (
                  <li key={i} style={{ paddingLeft: 4 }}>{step}</li>
                ))}
              </ol>
            </div>

            {/* Recommended specs */}
            <div className="card card-pad" style={{ marginTop: 24 }}>
              <h3 style={{ fontSize: 16, marginTop: 0, marginBottom: 12 }}>Recommended specs</h3>
              <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", rowGap: 8, columnGap: 16, fontSize: 13 }}>
                {SPECS.map((s) => (
                  <Fragment key={s.label}>
                    <div className="muted">{s.label}</div>
                    <div>{s.value}</div>
                  </Fragment>
                ))}
              </div>
            </div>

            {/* Footer note */}
            <p className="muted" style={{ fontSize: 12, textAlign: "center", marginTop: 32, lineHeight: 1.6 }}>
              Trouble with the download? Try the mirror link, or report it on the{" "}
              <a href="/forum">forum</a>. Last updated{" "}
              {new Date(client.updatedAt).toLocaleDateString()}.
            </p>
          </>
        )}
      </div>
    </Layout>
  );
}
