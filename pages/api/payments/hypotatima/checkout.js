// POST /api/payments/hypotatima/checkout — create Hypotatima hosted checkout
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findPackage } from "@/lib/payments/packages";
import { createCheckout, isConfigured } from "@/lib/payments/hypotatima";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const user = await requireUser(req, res);
  if (!user) return;

  if (!isConfigured()) {
    return res.status(503).json({
      error: "Hypotatima is not configured. See .env.example for required keys.",
    });
  }

  const { packageKey } = req.body || {};
  const pkg = findPackage(packageKey);
  if (!pkg) return res.status(400).json({ error: "Unknown package." });

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || `http://${req.headers.host}`;
  try {
    const checkout = await createCheckout({
      pkg,
      user,
      successUrl: `${baseUrl}/donate?success=1`,
      cancelUrl: `${baseUrl}/donate?cancelled=1`,
    });

    await prisma.payment.create({
      data: {
        userId: user.id,
        provider: "hypotatima",
        providerTxId: checkout.id,
        amount: pkg.amount,
        currency: pkg.currency,
        status: "pending",
        packageKey: pkg.key,
      },
    });

    res.json({ id: checkout.id, redirectUrl: checkout.redirectUrl });
  } catch (e) {
    console.error("Hypotatima checkout error:", e);
    res.status(500).json({ error: e.message });
  }
}
