// GET /api/_internal/gate — internal endpoint hit by middleware.js to learn
// the current install + license state.
//
// Returns: { installed: bool, locked: bool, status: string }
//
// We add Cache-Control so middleware can short-circuit when state hasn't
// changed. The cache is short (30s) because we want to flip the lock state
// quickly after a revalidation.
import { isInstalled, checkLicense } from "@/lib/license";

export default async function handler(req, res) {
  // Only allow internal callers
  if (req.headers["x-gate-internal"] !== "1") {
    return res.status(404).end();
  }

  const installed = await isInstalled();
  if (!installed) {
    res.setHeader("Cache-Control", "no-store");
    return res.json({ installed: false, locked: false, status: "not_installed" });
  }

  const { locked, reason, license } = await checkLicense();
  res.setHeader("Cache-Control", "private, max-age=30");
  res.json({
    installed: true,
    locked,
    status: license?.status || reason || "unknown",
  });
}
