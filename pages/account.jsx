// /account — current user's account view + payment history
import Layout from "@/components/Layout";
import { prisma, serializeServer } from "@/lib/prisma";
import { getCurrentUser, publicUser } from "@/lib/auth";

export async function getServerSideProps({ req, res }) {
  const user = await getCurrentUser(req, res);
  if (!user) return { redirect: { destination: "/login?next=/account", permanent: false } };

  const [server, payments] = await Promise.all([
    prisma.serverConfig.findUnique({ where: { id: 1 } }),
    prisma.payment.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return {
    props: {
      user: publicUser(user),
      server: serializeServer(server),
      payments: payments.map((p) => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
        completedAt: p.completedAt?.toISOString() || null,
      })),
    },
  };
}

export default function Account({ user, server, payments }) {
  const isVip = user.vipUntil && new Date(user.vipUntil) > new Date();

  return (
    <Layout user={user} server={server}>
      <div className="container page">
        <div className="page-header">
          <div>
            <div className="kicker">My Account</div>
            <h1 className="page-title">Hello, {user.username}</h1>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 24 }}>
          {/* Profile card */}
          <div className="card card-pad">
            <div className="kicker" style={{ marginBottom: 12 }}>Profile</div>
            <div style={{ fontSize: 13, lineHeight: 1.8 }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="muted">Username</span>
                <b>{user.username}</b>
              </div>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="muted">Email</span>
                <span>{user.email}</span>
              </div>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="muted">Role</span>
                <span className={`badge badge-${user.role === "admin" ? "accent" : user.role === "gm" ? "info" : ""}`}>
                  {user.role}
                </span>
              </div>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="muted">Joined</span>
                <span>{new Date(user.createdAt).toLocaleDateString()}</span>
              </div>
            </div>

            <div style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid var(--line-1)" }}>
              <div className="kicker" style={{ marginBottom: 6 }}>Silver balance</div>
              <div style={{ fontFamily: "var(--display)", fontSize: 28, fontWeight: 700, color: "var(--gold)" }}>
                {user.silver.toLocaleString()}
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <div className="kicker" style={{ marginBottom: 6 }}>VIP</div>
              {isVip ? (
                <>
                  <span className="badge badge-gold">Active</span>
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    Until {new Date(user.vipUntil).toLocaleDateString()}
                  </div>
                </>
              ) : (
                <span className="muted" style={{ fontSize: 13 }}>Not active</span>
              )}
            </div>
          </div>

          {/* Payment history */}
          <div className="card">
            <div className="card-section">
              <h2 className="card-title">Payment history</h2>
            </div>
            {payments.length === 0 ? (
              <div className="card-section muted" style={{ textAlign: "center", padding: 40 }}>
                No payments yet.
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Provider</th>
                    <th>Package</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td className="muted">{new Date(p.createdAt).toLocaleDateString()}</td>
                      <td>{p.provider}</td>
                      <td>{p.packageKey || "—"}</td>
                      <td className="mono">${p.amount.toFixed(2)}</td>
                      <td>
                        <span className={`badge badge-${
                          p.status === "completed" ? "accent" :
                          p.status === "failed" ? "danger" : ""
                        }`}>{p.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
