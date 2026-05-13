// /admin/game-db — connect to the game's MySQL database
import { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { prisma, serializeServer } from "@/lib/prisma";
import { getCurrentUser, publicUser } from "@/lib/auth";
import { getSafeConfig } from "@/lib/gameDb";

export async function getServerSideProps({ req, res }) {
  const user = await getCurrentUser(req, res);
  if (!user) return { redirect: { destination: "/login", permanent: false } };
  if (user.role !== "admin") {
    return { redirect: { destination: "/", permanent: false } };
  }

  const [server, config] = await Promise.all([
    prisma.serverConfig.findUnique({ where: { id: 1 } }),
    getSafeConfig(),
  ]);

  const safe = config || {
    id: 1,
    enabled: false,
    host: "127.0.0.1",
    port: 3306,
    database: "",
    user: "",
    passwordSet: false,
    accountTable: "TB_User",
    accountIdCol: "JID",
    accountUserCol: "StrUserID",
    accountPassCol: "password",
    accountEmailCol: "Email",
    uniqueKillTable: "_UniqueKillLog",
    rareDropTable: "_SoxItemLog",
    lastTestedAt: null,
    lastTestOk: false,
    lastTestError: null,
  };

  return {
    props: {
      user: publicUser(user),
      server: serializeServer(server),
      initial: {
        ...safe,
        lastTestedAt: safe.lastTestedAt
          ? safe.lastTestedAt.toISOString
            ? safe.lastTestedAt.toISOString()
            : safe.lastTestedAt
          : null,
      },
    },
  };
}

export default function AdminGameDb({ user, server, initial }) {
  const [form, setForm] = useState({
    enabled: initial.enabled,
    host: initial.host,
    port: initial.port,
    database: initial.database,
    user: initial.user,
    password: "",
    accountTable: initial.accountTable,
    accountIdCol: initial.accountIdCol,
    accountUserCol: initial.accountUserCol,
    accountPassCol: initial.accountPassCol,
    accountEmailCol: initial.accountEmailCol,
    uniqueKillTable: initial.uniqueKillTable,
    rareDropTable: initial.rareDropTable,
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [passwordSet, setPasswordSet] = useState(initial.passwordSet);
  const [lastTested, setLastTested] = useState({
    at: initial.lastTestedAt,
    ok: initial.lastTestOk,
    error: initial.lastTestError,
  });

  const set = (k, v) => setForm({ ...form, [k]: v });

  const test = async () => {
    setBusy(true);
    setTestResult(null);
    try {
      const r = await fetch("/api/admin/game-db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: form.host,
          port: form.port,
          database: form.database,
          user: form.user,
          password: form.password, // may be empty if already saved
        }),
      });
      const data = await r.json();
      setTestResult(data);
    } catch {
      setTestResult({ ok: false, error: "Network error" });
    } finally {
      setBusy(false);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/admin/game-db", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await r.json();
      if (!r.ok) {
        setMsg({ type: "error", text: data.error || "Save failed" });
      } else {
        setMsg({ type: "success", text: "Saved." });
        setPasswordSet(data.config.passwordSet);
        setForm((f) => ({ ...f, password: "" }));
        setLastTested({
          at: data.config.lastTestedAt,
          ok: data.config.lastTestOk,
          error: data.config.lastTestError,
        });
      }
    } catch {
      setMsg({ type: "error", text: "Network error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminLayout user={user} server={server} title="Game Database Connection">
      <div className="alert alert-info">
        <b>What is this?</b> Connect the website to your game server's MySQL database
        (vSRO, jSRO, etc) so registration writes accounts directly into the game, and
        the Unique History and SOX Drop Log pages show live data from the game.
        <br />
        The panel's own data (forum, news, payments, sessions) stays in its
        Prisma database — these two are separate.
      </div>

      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      {lastTested.at && (
        <div className={`alert ${lastTested.ok ? "alert-success" : "alert-error"}`}>
          Last test: {lastTested.ok ? "✓ OK" : "✗ Failed"} at{" "}
          {new Date(lastTested.at).toLocaleString()}
          {lastTested.error && <div style={{ marginTop: 6 }}>{lastTested.error}</div>}
        </div>
      )}

      <form onSubmit={save} className="card card-pad" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <h2 className="card-title">Connection</h2>

        <label className="checkbox">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => set("enabled", e.target.checked)}
          />
          Enable game DB integration
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
          <div className="field">
            <label className="field-label">Host</label>
            <input className="input" value={form.host}
              onChange={(e) => set("host", e.target.value)} placeholder="127.0.0.1" required />
          </div>
          <div className="field">
            <label className="field-label">Port</label>
            <input className="input" type="number" min={1} max={65535}
              value={form.port}
              onChange={(e) => set("port", parseInt(e.target.value, 10) || 3306)} required />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="field">
            <label className="field-label">Database name</label>
            <input className="input" value={form.database}
              onChange={(e) => set("database", e.target.value)}
              placeholder="SRO_VT_SHARD" required />
          </div>
          <div className="field">
            <label className="field-label">Username</label>
            <input className="input" value={form.user}
              onChange={(e) => set("user", e.target.value)}
              placeholder="sa" required />
          </div>
        </div>

        <div className="field">
          <label className="field-label">
            Password {passwordSet && <span className="muted" style={{ fontWeight: 400 }}>(saved — leave blank to keep)</span>}
          </label>
          <input className="input" type="password" value={form.password}
            onChange={(e) => set("password", e.target.value)}
            placeholder={passwordSet ? "••••••••" : ""} autoComplete="new-password" />
          <div className="field-hint">
            Stored encrypted with AES-256-GCM using a key derived from SESSION_SECRET.
          </div>
        </div>

        <div className="row" style={{ gap: 8, alignItems: "center" }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={test}
            disabled={busy || !form.host || !form.database || !form.user}
          >
            {busy ? "Testing…" : "Test connection"}
          </button>
          {testResult && (
            <span
              className={`badge ${testResult.ok ? "badge-accent" : "badge-danger"}`}
            >
              {testResult.ok
                ? `✓ Connected (MySQL ${testResult.version})`
                : `✗ ${testResult.error || "Failed"}`}
            </span>
          )}
        </div>

        <h2 className="card-title" style={{ marginTop: 18 }}>Schema mapping</h2>
        <p className="muted" style={{ fontSize: 13, marginTop: -6 }}>
          Different emulators (vSRO, jSRO, custom) use slightly different table and
          column names. Adjust these to match your server's schema.
        </p>

        <h3 style={{ fontSize: 14, marginTop: 8, color: "var(--ink-2)" }}>Accounts</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="field">
            <label className="field-label">Account table</label>
            <input className="input" value={form.accountTable}
              onChange={(e) => set("accountTable", e.target.value)} />
          </div>
          <div className="field">
            <label className="field-label">Account ID column</label>
            <input className="input" value={form.accountIdCol}
              onChange={(e) => set("accountIdCol", e.target.value)} />
          </div>
          <div className="field">
            <label className="field-label">Username column</label>
            <input className="input" value={form.accountUserCol}
              onChange={(e) => set("accountUserCol", e.target.value)} />
          </div>
          <div className="field">
            <label className="field-label">Password column</label>
            <input className="input" value={form.accountPassCol}
              onChange={(e) => set("accountPassCol", e.target.value)} />
          </div>
          <div className="field">
            <label className="field-label">Email column (optional)</label>
            <input className="input" value={form.accountEmailCol}
              onChange={(e) => set("accountEmailCol", e.target.value)} />
          </div>
        </div>

        <h3 style={{ fontSize: 14, marginTop: 12, color: "var(--ink-2)" }}>Logs</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="field">
            <label className="field-label">Unique kill log table</label>
            <input className="input" value={form.uniqueKillTable}
              onChange={(e) => set("uniqueKillTable", e.target.value)} />
          </div>
          <div className="field">
            <label className="field-label">SOX drop log table</label>
            <input className="input" value={form.rareDropTable}
              onChange={(e) => set("rareDropTable", e.target.value)} />
          </div>
        </div>

        <div className="row" style={{ gap: 8, marginTop: 8 }}>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>

      <div className="card card-pad" style={{ marginTop: 20 }}>
        <h3 className="card-title">⚠ Important notes</h3>
        <ul style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.7 }}>
          <li>
            <b>Password storage in the game DB.</b> The default account creation
            inserts the password as-is. If your emulator hashes passwords differently
            (some use plaintext, some hash on the auth server), edit{" "}
            <code>createGameAccount</code> in <code>lib/gameDb.js</code>.
          </li>
          <li>
            <b>SQL Server vs MySQL.</b> This driver speaks MySQL/MariaDB. Many silkroad
            emulators originally use Microsoft SQL Server — you'll need to either
            export to MySQL, run an emulator that uses MySQL, or swap the driver out
            (see <code>lib/gameDb.js</code>).
          </li>
          <li>
            <b>Two databases.</b> The panel keeps its own data (forum, payments, news)
            in the Prisma database configured in <code>.env</code>. The game DB
            connection above is read-mostly: the panel writes only when creating new
            accounts during registration.
          </li>
        </ul>
      </div>
    </AdminLayout>
  );
}
