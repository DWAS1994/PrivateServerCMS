// /admin/license — show current license status, last check, expiry.
import { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { prisma, serializeServer } from "@/lib/prisma";
import { getCurrentUser, publicUser } from "@/lib/auth";
import { getLicense } from "@/lib/license";

export async function getServerSideProps({ req, res }) {
  const user = await getCurrentUser(req, res);
  if (!user) return { redirect: { destination: "/login", permanent: false } };
  if (user.role !== "admin") {
    return { redirect: { destination: "/", permanent: false } };
  }

  const [server, license] = await Promise.all([
    prisma.serverConfig.findUnique({ where: { id: 1 } }),
    getLicense(),
  ]);

  return {
    props: {
      user: publicUser(user),
      server: serializeServer(server),
      license: license
        ? {
            // Never send the signing key to the client
            key: license.key,
            serverUrl: license.serverUrl,
            status: license.status,
            expiresAt: license.expiresAt?.toISOString() || null,
            lastCheckedAt: license.lastCheckedAt?.toISOString() || null,
            lastCheckOk: license.lastCheckOk,
            lastCheckError: license.lastCheckError,
          }
        : null,
    },
  };
}

const STATUS_BADGE = {
  active: "accent",
  past_due: "warn",
  cancelled: "danger",
  refunded: "danger",
  unverified: "warn",
  unknown: "danger",
};

export default function AdminLicense({ user, server, license }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const recheck = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/license-status?revalidate=1");
      const data = await r.json();
      if (data.lastCheckOk) {
        setMsg({ type: "success", text: `License is ${data.status}.` });
        setTimeout(() => location.reload(), 800);
      } else {
        setMsg({ type: "error", text: data.lastCheckError || "Check failed." });
      }
    } catch {
      setMsg({ type: "error", text: "Network error." });
    } finally {
      setBusy(false);
    }
  };

  if (!license) {
    return (
      <AdminLayout user={user} server={server} title="License">
        <div className="alert alert-error">No license configured. Strange — try re-running the install wizard.</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout user={user} server={server} title="License">
      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      <div className="card card-pad" style={{ marginBottom: 20 }}>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <div className="kicker">Current status</div>
            <div style={{ marginTop: 6 }}>
              <span className={`badge badge-${STATUS_BADGE[license.status] || "danger"}`}>
                {license.status}
              </span>
            </div>
          </div>
          <button className="btn btn-secondary" onClick={recheck} disabled={busy}>
            {busy ? "Checking…" : "Recheck now"}
          </button>
        </div>

        <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.8 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="muted">License key</span>
            <span className="mono">{license.key}</span>
          </div>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="muted">License server</span>
            <span className="mono" style={{ fontSize: 11 }}>{license.serverUrl}</span>
          </div>
          {license.expiresAt && (
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="muted">Renews</span>
              <b>{new Date(license.expiresAt).toLocaleDateString()}</b>
            </div>
          )}
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="muted">Last validation</span>
            <span>
              {license.lastCheckedAt
                ? new Date(license.lastCheckedAt).toLocaleString()
                : "Never"}
              {license.lastCheckedAt && (
                <span className={license.lastCheckOk ? "" : ""} style={{ marginLeft: 8 }}>
                  {license.lastCheckOk ? "✓" : "✗"}
                </span>
              )}
            </span>
          </div>
          {license.lastCheckError && (
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="muted">Last error</span>
              <span style={{ color: "var(--danger)" }}>{license.lastCheckError}</span>
            </div>
          )}
        </div>
      </div>

      <div className="card card-pad">
        <h3 className="card-title">Manage your subscription</h3>
        <p className="muted" style={{ fontSize: 13, marginTop: 8, lineHeight: 1.6 }}>
          To update your payment method, cancel, or pause billing, use the Stripe
          customer portal — the link is in any of the receipt emails from the vendor.
          The panel will pick up status changes within 24 hours, or you can hit
          "Recheck now" above to force an immediate update.
        </p>
      </div>
    </AdminLayout>
  );
}
