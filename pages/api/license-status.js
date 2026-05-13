// GET /api/license-status — returns current cached license status.
//   ?revalidate=1 to force a server hit (used by the lockout-page recheck button).
//
// Doesn't return the key/signing-key — only public status info.
import { getLicense, revalidateLicense } from "@/lib/license";

export default async function handler(req, res) {
  if (req.query.revalidate === "1") {
    await revalidateLicense();
  }
  const license = await getLicense();
  res.json({
    status: license?.status || "no_license",
    expiresAt: license?.expiresAt?.toISOString() || null,
    lastCheckedAt: license?.lastCheckedAt?.toISOString() || null,
    lastCheckOk: license?.lastCheckOk || false,
    lastCheckError: license?.lastCheckError || null,
  });
}
