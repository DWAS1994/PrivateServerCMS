// /donate — purchase silk/VIP packages via Stripe, PayPal, or Hypotatima
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import { prisma, serializeServer } from "@/lib/prisma";
import { getCurrentUser, publicUser } from "@/lib/auth";
import { PACKAGES } from "@/lib/payments/packages";
import * as stripeLib from "@/lib/payments/stripe";
import * as paypalLib from "@/lib/payments/paypal";
import * as hypoLib from "@/lib/payments/hypotatima";

export async function getServerSideProps({ req, res, query }) {
  const [user, server] = await Promise.all([
    getCurrentUser(req, res),
    prisma.serverConfig.findUnique({ where: { id: 1 } }),
  ]);

  return {
    props: {
      user: publicUser(user),
      server: serializeServer(server),
      providers: {
        stripe: stripeLib.isConfigured(),
        paypal: paypalLib.isConfigured(),
        hypotatima: hypoLib.isConfigured(),
      },
      flash: {
        success: query.success === "1",
        cancelled: query.cancelled === "1",
        error: query.error === "1",
      },
    },
  };
}

const PROVIDER_INFO = {
  stripe: { label: "Pay with card (Stripe)", icon: "💳" },
  paypal: { label: "Pay with PayPal", icon: "🅿️" },
  hypotatima: { label: "Pay with Hypotatima", icon: "🌐" },
};

export default function Donate({ user, server, providers, flash }) {
  const router = useRouter();
  const [selectedPkg, setSelectedPkg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const buy = async (pkg, provider) => {
    if (!user) {
      router.push("/login?next=/donate");
      return;
    }
    setErr("");
    setBusy(true);
    try {
      let endpoint;
      if (provider === "stripe") endpoint = "/api/payments/stripe/checkout";
      else if (provider === "paypal") endpoint = "/api/payments/paypal/create";
      else if (provider === "hypotatima") endpoint = "/api/payments/hypotatima/checkout";

      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageKey: pkg.key }),
      });
      const data = await r.json();
      if (!r.ok) {
        setErr(data.error || "Payment initialization failed.");
        setBusy(false);
        return;
      }
      // Redirect to provider's hosted checkout
      const url = data.url || data.approveUrl || data.redirectUrl;
      if (url) {
        window.location.href = url;
      } else {
        setErr("No checkout URL returned.");
        setBusy(false);
      }
    } catch (e) {
      setErr("Network error.");
      setBusy(false);
    }
  };

  return (
    <Layout user={user} server={server}>
      <div className="container page">
        <div className="page-header">
          <div>
            <div className="kicker">Support the Server</div>
            <h1 className="page-title">Donate</h1>
            <p className="page-subtitle">
              Server costs are real. Every contribution helps keep the lights on — and you get
              in-game silk and VIP perks in return.
            </p>
          </div>
        </div>

        {flash.success && (
          <div className="alert alert-success">
            ✓ Payment received! Your account has been credited. Thank you for your support.
          </div>
        )}
        {flash.cancelled && (
          <div className="alert alert-info">
            Payment cancelled. No charge was made.
          </div>
        )}
        {flash.error && (
          <div className="alert alert-error">
            Something went wrong with the payment. If you were charged, contact staff.
          </div>
        )}

        {!user && (
          <div className="alert alert-info">
            <Link href="/login?next=/donate">Login</Link> or{" "}
            <Link href="/register">create an account</Link> first — donations are tied to
            your account so silk/VIP can be credited.
          </div>
        )}

        {err && <div className="alert alert-error">{err}</div>}

        {/* Package grid */}
        <div className="pkg-grid">
          {PACKAGES.map((pkg, i) => (
            <div key={pkg.key} className={`pkg ${i === 1 ? "featured" : ""}`}>
              {i === 1 && (
                <span className="badge badge-accent" style={{ alignSelf: "flex-start" }}>
                  Most popular
                </span>
              )}
              <div className="pkg-name">{pkg.name}</div>
              <div className="pkg-price">
                ${pkg.amount.toFixed(2)}
                <small> {pkg.currency}</small>
              </div>
              <div className="pkg-desc">{pkg.description}</div>
              <div className="row" style={{ gap: 6, fontSize: 12, flexWrap: "wrap" }}>
                {pkg.silk > 0 && (
                  <span className="badge badge-gold">
                    💰 {pkg.silk.toLocaleString()} silk
                  </span>
                )}
                {pkg.vipDays > 0 && (
                  <span className="badge badge-accent">
                    ⭐ VIP · {pkg.vipDays} days
                  </span>
                )}
              </div>
              <button
                className="btn btn-primary btn-block"
                onClick={() => setSelectedPkg(selectedPkg?.key === pkg.key ? null : pkg)}
                disabled={busy}
              >
                {selectedPkg?.key === pkg.key ? "Choose payment method ↓" : "Select"}
              </button>

              {selectedPkg?.key === pkg.key && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                  {Object.entries(PROVIDER_INFO).map(([key, info]) => (
                    <button
                      key={key}
                      className="btn btn-secondary btn-block"
                      onClick={() => buy(pkg, key)}
                      disabled={busy || !providers[key]}
                      title={!providers[key] ? `${key} is not configured` : ""}
                    >
                      <span style={{ marginRight: 6 }}>{info.icon}</span>
                      {info.label}
                      {!providers[key] && (
                        <span className="muted" style={{ marginLeft: 6, fontSize: 10 }}>
                          (not configured)
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="card card-pad" style={{ marginTop: 32 }}>
          <h3 className="card-title">FAQ</h3>
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <b>How fast is delivery?</b>
              <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                Stripe and PayPal credit your account immediately on successful payment.
                Hypotatima delivery time depends on the payment method used (instant for cards,
                minutes for bank transfers).
              </p>
            </div>
            <div>
              <b>Refunds?</b>
              <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                In-game items are non-refundable once delivered. If something goes wrong with the
                payment itself, contact staff in #support.
              </p>
            </div>
            <div>
              <b>Is this pay-to-win?</b>
              <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                That's up to the server admin's policy. Donations exist to help cover hosting
                costs; the server economy is balanced separately.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
