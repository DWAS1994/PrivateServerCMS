// /licensed-expired — shown when the license check fails. Only escape is
// fixing the subscription and re-validating.
import { useState } from "react";
import { prisma } from "@/lib/prisma";
import { isInstalled, getLicense } from "@/lib/license";

export async function getServerSideProps() {
  // If somehow not installed yet, send to the wizard
  if (!(await isInstalled())) {
    return { redirect: { destination: "/install", permanent: false } };
  }
  const license = await getLicense();
  // If the license is actually fine, don't gate us on the lockout page
  if (license && license.status === "active") {
    return { redirect: { destination: "/", permanent: false } };
  }
  return {
    props: {
      status: license?.status || "unknown",
      lastError: license?.lastCheckError || null,
      lastCheckedAt: license?.lastCheckedAt?.toISOString() || null,
      expiresAt: license?.expiresAt?.toISOString() || null,
    },
  };
}

const STATUS_TITLES = {
  past_due: "Payment failed",
  cancelled: "Subscription cancelled",
  refunded: "Subscription refunded",
  no_license: "License missing",
  unknown: "License inactive",
  unverified: "License not verified",
};
const STATUS_BODIES = {
  past_due:
    "Your most recent payment didn't go through. Update your card in the Stripe " +
    "portal (linked in your receipt email) and the panel will reactivate " +
    "automatically within a minute.",
  cancelled:
    "Your subscription was cancelled. Start a new subscription to reactivate " +
    "the panel.",
  refunded:
    "Your subscription was refunded. If this was a mistake, contact the vendor " +
    "to reactivate.",
  no_license:
    "No license key is configured. Re-run the install wizard or contact the vendor.",
  unverified:
    "We haven't been able to verify your license with the license server. " +
    "Check your internet connection and try again.",
  unknown:
    "License status is unknown. Try recheck — if the problem persists, contact " +
    "the vendor.",
};

export default function Expired({ status, lastError, lastCheckedAt, expiresAt }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const recheck = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/license-status?revalidate=1");
      const data = await r.json();
      if (data.status === "active") {
        location.href = "/";
        return;
      }
      setMsg(
        `Still ${data.status}${data.lastCheckError ? ` (${data.lastCheckError})` : ""}.`
      );
    } catch {
      setMsg("Couldn't reach the license server.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-0)", color: "var(--ink-1)", display: "grid", placeItems: "center", padding: 20 }}>
      <div className="card card-pad" style={{ maxWidth: 520, width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 64, marginBottom: 8 }}>🔒</div>
          <h1 style={{ fontSize: 28, marginBottom: 6 }}>
            {STATUS_TITLES[status] || "License inactive"}
          </h1>
          <p className="muted" style={{ fontSize: 14, lineHeight: 1.6 }}>
            {STATUS_BODIES[status] || STATUS_BODIES.unknown}
          </p>
        </div>

        <div style={{ background: "var(--bg-2)", padding: 14, borderRadius: 10, fontSize: 13 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="muted">Status</span>
            <b>{status}</b>
          </div>
          {expiresAt && (
            <div className="row" style={{ justifyContent: "space-between", marginTop: 6 }}>
              <span className="muted">Expired</span>
              <span>{new Date(expiresAt).toLocaleDateString()}</span>
            </div>
          )}
          {lastCheckedAt && (
            <div className="row" style={{ justifyContent: "space-between", marginTop: 6 }}>
              <span className="muted">Last verified</span>
              <span>{new Date(lastCheckedAt).toLocaleString()}</span>
            </div>
          )}
          {lastError && (
            <div className="row" style={{ justifyContent: "space-between", marginTop: 6 }}>
              <span className="muted">Last error</span>
              <span style={{ color: "var(--danger)" }}>{lastError}</span>
            </div>
          )}
        </div>

        {msg && <div className="alert alert-info" style={{ marginTop: 14 }}>{msg}</div>}

        <button
          className="btn btn-primary btn-block"
          onClick={recheck}
          disabled={busy}
          style={{ marginTop: 20 }}
        >
          {busy ? "Checking…" : "I've fixed it — recheck now"}
        </button>

        <p className="muted" style={{ fontSize: 12, textAlign: "center", marginTop: 20, lineHeight: 1.6 }}>
          The panel checks your subscription roughly once a day. After updating
          your payment method, hit the button above to revalidate immediately.
        </p>
      </div>
    </div>
  );
}
