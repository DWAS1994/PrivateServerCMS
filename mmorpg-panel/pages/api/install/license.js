// POST /api/install/license — validate license against the license server,
// save the key + URL + signing key into the License table.
//
// Only callable while the install wizard hasn't been completed.
import { prisma } from "@/lib/prisma";
import {
  isInstalled,
  saveLicenseConfig,
  revalidateLicense,
} from "@/lib/license";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (await isInstalled()) {
    return res.status(403).json({ error: "Install already completed." });
  }

  const { key, serverUrl, signingKey } = req.body || {};
  if (!key || !serverUrl || !signingKey) {
    return res.status(400).json({ error: "All three fields are required." });
  }
  // Basic format validation on the key
  if (!/^MMRPG(-[A-Z0-9]+){2,}$/i.test(key.trim())) {
    return res.status(400).json({ error: "License key doesn't look right." });
  }
  try {
    new URL(serverUrl);
  } catch {
    return res.status(400).json({ error: "License server URL is invalid." });
  }

  // Save config first so revalidateLicense() has something to read
  await saveLicenseConfig({ key, serverUrl, signingKey });

  // Hit the license server
  const license = await revalidateLicense();

  if (!license.lastCheckOk) {
    return res.status(502).json({
      error:
        `Couldn't reach the license server (${license.lastCheckError || "unknown error"}). ` +
        "Double-check the URL and signing key, then try again.",
    });
  }
  if (license.status !== "active") {
    return res.status(402).json({
      error: `License is not active. Status: ${license.status}. ` +
        "If you just paid, give it a minute and try again.",
    });
  }

  return res.json({ ok: true, status: license.status });
}
