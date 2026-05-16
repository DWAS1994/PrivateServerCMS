// POST /api/payments/stripe/checkout — create Stripe Checkout session
import { requireUser } from "@/lib/auth";
import { findPackage } from "@/lib/payments/packages";
import { createCheckoutSession, isConfigured } from "@/lib/payments/stripe";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const user = await requireUser(req, res);
  if (!user) return;

  if (!isConfigured()) {
    return res.status(503).json({
      error: "Stripe is not configured. Add STRIPE_SECRET_KEY to your .env file.",
    });
  }

  const { packageKey } = req.body || {};
  const pkg = findPackage(packageKey);
  if (!pkg) return res.status(400).json({ error: "Unknown package." });

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || `http://${req.headers.host}`;
  try {
    const session = await createCheckoutSession({
      pkg,
      user,
      successUrl: `${baseUrl}/donate?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${baseUrl}/donate?cancelled=1`,
    });
    res.json({ url: session.url, sessionId: session.id });
  } catch (e) {
    console.error("Stripe checkout error:", e);
    res.status(500).json({ error: e.message });
  }
}
