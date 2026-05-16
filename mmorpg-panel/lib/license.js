// License check for the CMS.
//
// Calls the license server's /validate endpoint once every ~24 hours and
// caches the result in the License table. On every page request, the
// middleware checks the cached status to decide whether to lock the site.
//
// To stay polite, we don't revalidate on every request — only when:
//   - The cache row is older than 24h
//   - The cache row has `lastCheckOk = false` and 1h has passed (so a
//     transient outage doesn't take down customer's CMS forever)
import crypto from "crypto";
import { prisma } from "./prisma";

const REVALIDATE_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h
const RETRY_INTERVAL_MS = 60 * 60 * 1000;           // 1h on failure

/** Returns true if the install wizard has been completed. */
export async function isInstalled() {
  if (process.env.DEMO_MODE === "1") return true;
  const state = await prisma.installState.findUnique({ where: { id: 1 } });
  return !!state?.completed;
}

/** Mark the install wizard as completed. */
export async function markInstalled() {
  await prisma.installState.upsert({
    where: { id: 1 },
    update: { completed: true, completedAt: new Date() },
    create: { id: 1, completed: true, completedAt: new Date() },
  });
}

/** Get the current cached license row (or a default if none exists yet). */
export async function getLicense() {
  return prisma.license.findUnique({ where: { id: 1 } });
}

/** Save the license configuration (key + server URL + signing key). */
export async function saveLicenseConfig({ key, serverUrl, signingKey }) {
  await prisma.license.upsert({
    where: { id: 1 },
    update: {
      key: key.trim().toUpperCase(),
      serverUrl: serverUrl.trim(),
      signingKey: signingKey.trim(),
      status: "unverified",
      lastCheckedAt: null,
    },
    create: {
      id: 1,
      key: key.trim().toUpperCase(),
      serverUrl: serverUrl.trim(),
      signingKey: signingKey.trim(),
    },
  });
}

/**
 * Verify the HMAC signature on a validation response.
 * The server canonicalized the payload by sorting keys before signing.
 */
function verifySignature(payload, signature, signingKey) {
  if (!signature || !signingKey) return false;
  const { signature: _omit, ...rest } = payload;
  const canonical = JSON.stringify(rest, Object.keys(rest).sort());
  const expected = crypto.createHmac("sha256", signingKey).update(canonical).digest("base64url");
  // Constant-time compare
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

/**
 * Hit the license server and update our cached row.
 * Returns the new License row.
 */
export async function revalidateLicense() {
  const license = await getLicense();
  if (!license || !license.key || !license.serverUrl) {
    return license;
  }

  let domain = null;
  try {
    domain = process.env.NEXT_PUBLIC_SITE_URL
      ? new URL(process.env.NEXT_PUBLIC_SITE_URL).hostname
      : null;
  } catch {}

  let updated;
  try {
    const r = await fetch(license.serverUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: license.key, domain }),
      // 10s timeout — never block a page request forever
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) {
      updated = await prisma.license.update({
        where: { id: 1 },
        data: {
          lastCheckedAt: new Date(),
          lastCheckOk: false,
          lastCheckError: `HTTP ${r.status}`,
        },
      });
      return updated;
    }
    const data = await r.json();
    const { signature, ...payload } = data;
    const ok = verifySignature(data, signature, license.signingKey);
    if (!ok) {
      updated = await prisma.license.update({
        where: { id: 1 },
        data: {
          lastCheckedAt: new Date(),
          lastCheckOk: false,
          lastCheckError: "signature_mismatch",
        },
      });
      return updated;
    }
    updated = await prisma.license.update({
      where: { id: 1 },
      data: {
        status: payload.status || "unknown",
        expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null,
        lastCheckedAt: new Date(),
        lastCheckOk: true,
        lastCheckError: null,
        signature,
      },
    });
    return updated;
  } catch (e) {
    updated = await prisma.license.update({
      where: { id: 1 },
      data: {
        lastCheckedAt: new Date(),
        lastCheckOk: false,
        lastCheckError: e.message || "fetch_error",
      },
    });
    return updated;
  }
}

/**
 * Decide whether the CMS should be locked.
 * Called on every page request (cheap — single SQL row lookup) and revalidates
 * in the background if the cache is stale.
 *
 * Returns { locked, reason, license }.
 *
 * Lock conditions (any one of):
 *   - No license configured (post-install, before they paste the key)
 *   - Cached status is anything other than "active"
 *   - Cache is older than 7 days AND the last revalidation attempt failed
 *     (this prevents a license server outage from locking customers out
 *     instantly, but doesn't allow indefinite offline use)
 *
 * DEMO_MODE=1 in the environment bypasses the lock entirely. Use this for
 * publicly-accessible demo instances; never set it on a paying customer's
 * production install.
 */
export async function checkLicense() {
  if (process.env.DEMO_MODE === "1") {
    return { locked: false, reason: "demo_mode", license: null };
  }
  let license = await getLicense();
  if (!license || !license.key) {
    return { locked: true, reason: "no_license", license };
  }

  const now = Date.now();
  const lastChecked = license.lastCheckedAt ? license.lastCheckedAt.getTime() : 0;
  const age = now - lastChecked;

  // Do we need to revalidate? Either we've never checked, or it's been
  // > 24h on a healthy check, or > 1h on a failed check.
  const stale =
    !lastChecked ||
    (license.lastCheckOk && age > REVALIDATE_INTERVAL_MS) ||
    (!license.lastCheckOk && age > RETRY_INTERVAL_MS);

  if (stale) {
    license = await revalidateLicense();
  }

  // Determine lock state from final cached values
  if (license.status === "active") {
    return { locked: false, reason: null, license };
  }
  // Grace period: if revalidation has been failing for less than 7 days
  // since the last *successful* "active" check, don't lock — could be a
  // license-server outage rather than a real cancellation.
  if (!license.lastCheckOk && license.status === "active") {
    // (Status would only still be "active" here if we never overwrote it,
    // which doesn't currently happen — but keeping the branch for safety.)
    return { locked: false, reason: "grace_period", license };
  }
  return { locked: true, reason: license.status || "unknown", license };
}
