// /news
import Layout from "@/components/Layout";
import { prisma, serializeServer } from "@/lib/prisma";
import { getCurrentUser, publicUser } from "@/lib/auth";

export async function getServerSideProps({ req, res }) {
  const [user, server, posts] = await Promise.all([
    getCurrentUser(req, res),
    prisma.serverConfig.findUnique({ where: { id: 1 } }),
    prisma.newsPost.findMany({
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      take: 100,
    }),
  ]);
  return {
    props: {
      user: publicUser(user),
      server: serializeServer(server),
      posts: posts.map((p) => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      })),
    },
  };
}

export default function News({ user, server, posts }) {
  return (
    <Layout user={user} server={server}>
      <div className="container page">
        <div className="page-header">
          <div>
            <div className="kicker">Server News</div>
            <h1 className="page-title">News & Announcements</h1>
            <p className="page-subtitle">{posts.length} posts</p>
          </div>
        </div>

        {posts.length === 0 ? (
          <div className="card card-pad muted" style={{ textAlign: "center", padding: 60 }}>
            No news posts yet.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {posts.map((post) => (
              <article key={post.id} className="card card-pad">
                <div className="row" style={{ gap: 6, marginBottom: 10 }}>
                  <span className={`badge badge-${
                    post.category === "patch" ? "info" :
                    post.category === "event" ? "gold" : "accent"
                  }`}>
                    {post.category}
                  </span>
                  {post.pinned && <span className="badge badge-warn">📌 Pinned</span>}
                  <span className="muted" style={{ fontSize: 12, marginLeft: "auto" }}>
                    {new Date(post.createdAt).toLocaleString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <h2 style={{ fontSize: 22, marginBottom: 10 }}>{post.title}</h2>
                <p style={{ color: "var(--ink-2)", fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                  {post.body}
                </p>
                <div className="muted" style={{ fontSize: 12, marginTop: 14 }}>
                  Posted by <b>{post.author}</b>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
