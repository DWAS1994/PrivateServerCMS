// /install — first-run setup wizard.
//
// Steps:
//   1. Welcome
//   2. License key + license-server URL + signing key
//      → validates against license server before continuing
//   3. Create the first admin user
//   4. Server name + MOTD
//   5. Done
//
// Once the wizard completes, /api/install/complete flips InstallState.completed
// and the user is redirected to the homepage.
import { useState } from "react";
import { useRouter } from "next/router";
import { prisma } from "@/lib/prisma";
import { isInstalled } from "@/lib/license";

export async function getServerSideProps() {
  if (await isInstalled()) {
    return { redirect: { destination: "/", permanent: false } };
  }
  return { props: {} };
}

const STEPS = ["welcome", "license", "admin", "server", "done"];

export default function Install() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({
    licenseKey: "",
    licenseServerUrl: "https://license.yourcms.example/api/licenses/validate",
    licenseSigningKey: "",
    adminUsername: "admin",
    adminEmail: "",
    adminPassword: "",
    serverName: "My MMORPG Server",
    motd: "Welcome, adventurer!",
  });

  const set = (k, v) => setForm({ ...form, [k]: v });

  // ── Step submit handlers ──
  const submitLicense = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/install/license", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: form.licenseKey,
          serverUrl: form.licenseServerUrl,
          signingKey: form.licenseSigningKey,
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        setErr(data.error || "License check failed.");
        setBusy(false);
        return;
      }
      setStep(2);
    } catch {
      setErr("Network error — could not reach the license server.");
    } finally {
      setBusy(false);
    }
  };

  const submitAdmin = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/install/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: form.adminUsername,
          email: form.adminEmail,
          password: form.adminPassword,
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        setErr(data.error || "Admin creation failed.");
        setBusy(false);
        return;
      }
      setStep(3);
    } catch {
      setErr("Network error.");
    } finally {
      setBusy(false);
    }
  };

  const submitServer = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/install/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverName: form.serverName, motd: form.motd }),
      });
      const data = await r.json();
      if (!r.ok) {
        setErr(data.error || "Setup failed.");
        setBusy(false);
        return;
      }
      setStep(4);
    } catch {
      setErr("Network error.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-0)", color: "var(--ink-1)" }}>
      <main className="container" style={{ paddingTop: 60, paddingBottom: 60, maxWidth: 620 }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div className="brand" style={{ justifyContent: "center", marginBottom: 16 }}>
            <span className="brand-mark">⚔</span>
            <span>MMORPG Panel — Install</span>
          </div>
          <div className="row" style={{ justifyContent: "center", gap: 8 }}>
            {STEPS.map((s, i) => (
              <span
                key={s}
                style={{
                  width: 32, height: 4, borderRadius: 2,
                  background: i <= step ? "var(--accent)" : "var(--line-2)",
                  transition: "background 0.2s",
                }}
              />
            ))}
          </div>
        </div>

        {err && <div className="alert alert-error">{err}</div>}

        {step === 0 && (
          <div className="card card-pad">
            <h1 style={{ fontSize: 28, marginBottom: 14 }}>Welcome!</h1>
            <p style={{ color: "var(--ink-2)", lineHeight: 1.6, marginBottom: 14 }}>
              Let's get your MMORPG Panel up and running. This wizard will:
            </p>
            <ul style={{ color: "var(--ink-2)", lineHeight: 1.8, paddingLeft: 20 }}>
              <li>Validate your license key against the license server</li>
              <li>Create your first admin user</li>
              <li>Set the server name and message of the day</li>
            </ul>
            <p style={{ color: "var(--ink-3)", fontSize: 13, marginTop: 14, lineHeight: 1.6 }}>
              You'll need your license key handy. It was emailed to you after purchase
              and looks like <code style={{ background: "var(--bg-2)", padding: "2px 6px", borderRadius: 4 }}>MMRPG-XXXX-XXXX-XXXX-XXXX</code>.
            </p>
            <button
              className="btn btn-primary btn-block"
              style={{ marginTop: 20 }}
              onClick={() => setStep(1)}
            >
              Let's go →
            </button>
          </div>
        )}

        {step === 1 && (
          <form onSubmit={submitLicense} className="card card-pad" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <h2 style={{ fontSize: 24 }}>License key</h2>
            <p className="muted" style={{ fontSize: 13, lineHeight: 1.55 }}>
              Paste the key you received after purchase. We'll verify it against the
              license server in real time.
            </p>
            <div className="field">
              <label className="field-label">License key</label>
              <input
                className="input"
                value={form.licenseKey}
                onChange={(e) => set("licenseKey", e.target.value)}
                placeholder="MMRPG-XXXX-XXXX-XXXX-XXXX"
                required
                style={{ fontFamily: "var(--mono)", letterSpacing: "0.05em" }}
              />
            </div>
            <div className="field">
              <label className="field-label">License server URL</label>
              <input
                className="input"
                type="url"
                value={form.licenseServerUrl}
                onChange={(e) => set("licenseServerUrl", e.target.value)}
                required
              />
              <div className="field-hint">
                From the vendor's installation email. Looks like
                <code> https://license.yourcms.com/api/licenses/validate</code>.
              </div>
            </div>
            <div className="field">
              <label className="field-label">Signing key</label>
              <input
                className="input"
                type="password"
                value={form.licenseSigningKey}
                onChange={(e) => set("licenseSigningKey", e.target.value)}
                placeholder="Long hex string from the vendor"
                required
              />
              <div className="field-hint">
                Used to verify that validation responses came from the real license
                server. Don't share this.
              </div>
            </div>
            <button className="btn btn-primary btn-block" disabled={busy}>
              {busy ? "Validating…" : "Validate & continue"}
            </button>
            <button type="button" className="btn btn-secondary btn-block" onClick={() => setStep(0)} disabled={busy}>
              ← Back
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={submitAdmin} className="card card-pad" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <h2 style={{ fontSize: 24 }}>Create your admin account</h2>
            <p className="muted" style={{ fontSize: 13 }}>
              This is your master account for managing the panel.
            </p>
            <div className="field">
              <label className="field-label">Username</label>
              <input
                className="input"
                value={form.adminUsername}
                onChange={(e) => set("adminUsername", e.target.value)}
                pattern="[a-zA-Z0-9_]+"
                minLength={3}
                maxLength={20}
                required
              />
            </div>
            <div className="field">
              <label className="field-label">Email</label>
              <input
                className="input"
                type="email"
                value={form.adminEmail}
                onChange={(e) => set("adminEmail", e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label className="field-label">Password</label>
              <input
                className="input"
                type="password"
                value={form.adminPassword}
                onChange={(e) => set("adminPassword", e.target.value)}
                minLength={8}
                required
              />
              <div className="field-hint">At least 8 characters.</div>
            </div>
            <button className="btn btn-primary btn-block" disabled={busy}>
              {busy ? "Creating…" : "Create admin"}
            </button>
          </form>
        )}

        {step === 3 && (
          <form onSubmit={submitServer} className="card card-pad" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <h2 style={{ fontSize: 24 }}>Server name & welcome message</h2>
            <p className="muted" style={{ fontSize: 13 }}>
              These show on the homepage hero. You can change them later in
              Admin → Server Settings.
            </p>
            <div className="field">
              <label className="field-label">Server name</label>
              <input
                className="input"
                value={form.serverName}
                onChange={(e) => set("serverName", e.target.value)}
                maxLength={100}
                required
              />
            </div>
            <div className="field">
              <label className="field-label">Message of the day</label>
              <input
                className="input"
                value={form.motd}
                onChange={(e) => set("motd", e.target.value)}
                maxLength={500}
              />
            </div>
            <button className="btn btn-primary btn-block" disabled={busy}>
              {busy ? "Saving…" : "Finish setup"}
            </button>
          </form>
        )}

        {step === 4 && (
          <div className="card card-pad" style={{ textAlign: "center" }}>
            <div style={{ fontSize: 64, marginBottom: 14 }}>🎉</div>
            <h2 style={{ fontSize: 28, marginBottom: 14 }}>You're all set!</h2>
            <p className="muted" style={{ marginBottom: 24 }}>
              Your CMS is installed and your license is active. Time to bring your server to life.
            </p>
            <button
              className="btn btn-primary btn-block"
              onClick={() => router.push("/")}
            >
              Go to homepage
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
