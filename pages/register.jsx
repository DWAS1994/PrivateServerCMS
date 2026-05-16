// /register
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import { prisma, serializeServer } from "@/lib/prisma";
import { getCurrentUser, publicUser } from "@/lib/auth";
import { isConfigured as discordConfigured } from "@/lib/discord";

export async function getServerSideProps({ req, res }) {
  const [user, server] = await Promise.all([
    getCurrentUser(req, res),
    prisma.serverConfig.findUnique({ where: { id: 1 } }),
  ]);
  if (user) return { redirect: { destination: "/account", permanent: false } };
  return {
    props: {
      user: null,
      server: serializeServer(server),
      discordEnabled: discordConfigured(),
    },
  };
}

export default function Register({ server, discordEnabled }) {
  const router = useRouter();
  const [form, setForm] = useState({ username: "", email: "", password: "", confirm: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (form.password !== form.confirm) {
      setErr("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: form.username,
          email: form.email,
          password: form.password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "Registration failed.");
        setBusy(false);
        return;
      }
      router.push("/account");
    } catch (e) {
      setErr("Network error.");
      setBusy(false);
    }
  };

  return (
    <Layout user={null} server={server}>
      <div className="container page" style={{ maxWidth: 460 }}>
        <div className="card card-pad" style={{ padding: 32 }}>
          <h1 className="section-title">Create Account</h1>
          <p className="muted" style={{ fontSize: 13, marginBottom: 20 }}>
            Free to register. You'll be able to log in to the game with the same credentials.
          </p>

          {err && <div className="alert alert-error">{err}</div>}

          {/* Discord OAuth — kicks off the OAuth flow */}
          {discordEnabled ? (
            <>
              <a
                href="/api/auth/discord"
                className="btn btn-discord btn-block"
                style={{ marginBottom: 14 }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: 6 }}>
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                </svg>
                Continue with Discord
              </a>

              <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 0 14px" }}>
                <div style={{ flex: 1, height: 1, background: "var(--line-1)" }} />
                <span className="muted" style={{ fontSize: 11 }}>OR</span>
                <div style={{ flex: 1, height: 1, background: "var(--line-1)" }} />
              </div>
            </>
          ) : null}

          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="field">
              <label className="field-label">Username</label>
              <input
                className="input"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                pattern="[a-zA-Z0-9_]+"
                minLength={3}
                maxLength={20}
                required
                autoFocus
              />
              <div className="field-hint">3–20 chars, letters/numbers/underscores</div>
            </div>
            <div className="field">
              <label className="field-label">Email</label>
              <input
                className="input"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label className="field-label">Password</label>
              <input
                className="input"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                minLength={6}
                required
              />
              <div className="field-hint">Minimum 6 characters</div>
            </div>
            <div className="field">
              <label className="field-label">Confirm password</label>
              <input
                className="input"
                type="password"
                value={form.confirm}
                onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                minLength={6}
                required
              />
            </div>
            <button className="btn btn-primary btn-lg" disabled={busy}>
              {busy ? "Creating…" : "Create account"}
            </button>
          </form>
		  <button className="btn btn-primary btn-lg" disabled={busy}>
			  {busy ? "Downloading" : "Download Client"}
			 </button>

          <p className="muted" style={{ fontSize: 13, marginTop: 18, textAlign: "center" }}>
            Already have an account? <Link href="/login">Login</Link>
          </p>
        </div>
      </div>
    </Layout>
  );
}
