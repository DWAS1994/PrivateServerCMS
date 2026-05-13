// /admin/payments — payment history with filters and totals
import { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { prisma, serializeServer } from "@/lib/prisma";
import { getCurrentUser, publicUser } from "@/lib/auth";

export async function getServerSideProps({ req, res }) {
  const user = await getCurrentUser(req, res);
  if (!user) return { redirect: { destination: "/login", permanent: false } };
  if (user.role !== "admin" && user.role !== "gm") {
    return { redirect: { destination: "/", permanent: false } };
  }

  const [server, payments, totals] = await Promise.all([
    prisma.serverConfig.findUnique({ where: { id: 1 } }),
    prisma.payment.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        user: { select: { id: true, username: true, email: true } },
      },
    }),
    prisma.payment.groupBy({
      by: ["provider", "status"],
      _sum: { amount: true },
      _count: true,
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
      totals,
    },
  };
}

export default function AdminPayments({ user, server, payments, totals }) {
  const [filter, setFilter] = useState({ provider: "", status: "" });

  const filtered = payments.filter((p) => {
    if (filter.provider && p.provider !== filter.provider) return false;
    if (filter.status && p.status !== filter.status) return false;
    return true;
  });

  const completedTotal = totals
    .filter((t) => t.status === "completed")
    .reduce((s, t) => s + (t._sum.amount || 0), 0);

  const providerTotals = {};
  for (const t of totals) {
    if (t.status !== "completed") continue;
    providerTotals[t.provider] = (providerTotals[t.provider] || 0) + (t._sum.amount || 0);
  }

  return (
    <AdminLayout user={user} server={server} title="Payments">
      <div className="status-grid" style={{ marginBottom: 20 }}>
        <div className="status-card">
          <div className="status-label">Lifetime revenue</div>
          <div className="status-value" style={{ color: "var(--gold)" }}>
            ${completedTotal.toFixed(2)}
          </div>
          <div className="status-sub">Completed payments only</div>
        </div>
        <div className="status-card">
          <div className="status-label">Stripe</div>
          <div className="status-value">${(providerTotals.stripe || 0).toFixed(2)}</div>
          <div className="status-sub">Card payments</div>
        </div>
        <div className="status-card">
          <div className="status-label">PayPal</div>
          <div className="status-value">${(providerTotals.paypal || 0).toFixed(2)}</div>
          <div className="status-sub">PayPal payments</div>
        </div>
        <div className="status-card">
          <div className="status-label">Hypotatima</div>
          <div className="status-value">${(providerTotals.hypotatima || 0).toFixed(2)}</div>
          <div className="status-sub">Hypotatima payments</div>
        </div>
      </div>

      <div className="row" style={{ marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <select className="select" value={filter.provider}
          onChange={(e) => setFilter({ ...filter, provider: e.target.value })}
          style={{ maxWidth: 180 }}>
          <option value="">All providers</option>
          <option value="stripe">Stripe</option>
          <option value="paypal">PayPal</option>
          <option value="hypotatima">Hypotatima</option>
        </select>
        <select className="select" value={filter.status}
          onChange={(e) => setFilter({ ...filter, status: e.target.value })}
          style={{ maxWidth: 180 }}>
          <option value="">All statuses</option>
          <option value="completed">Completed</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
        </select>
        <span className="muted">{filtered.length} shown</span>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>User</th>
              <th>Provider</th>
              <th>Package</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Tx ID</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id}>
                <td className="muted" style={{ fontSize: 12 }}>
                  {new Date(p.createdAt).toLocaleString()}
                </td>
                <td>
                  <b>{p.user?.username || `#${p.userId}`}</b>
                  {p.user?.email && (
                    <div className="muted" style={{ fontSize: 11 }}>{p.user.email}</div>
                  )}
                </td>
                <td>
                  <span className="badge">{p.provider}</span>
                </td>
                <td className="muted" style={{ fontSize: 12 }}>{p.packageKey || "—"}</td>
                <td className="mono">${p.amount.toFixed(2)} {p.currency}</td>
                <td>
                  <span className={`badge badge-${
                    p.status === "completed" ? "accent" :
                    p.status === "failed" ? "danger" :
                    p.status === "refunded" ? "warn" : ""
                  }`}>
                    {p.status}
                  </span>
                </td>
                <td className="muted mono" style={{ fontSize: 11, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {p.providerTxId}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="muted" style={{ textAlign: "center", padding: 40 }}>
            No payments match these filters.
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
