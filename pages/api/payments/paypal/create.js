// POST /api/payments/paypal/create — create PayPal order, return approve URL
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findPackage } from "@/lib/payments/packages";
import { createOrder, isConfigured } from "@/lib/payments/paypal";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const user = await requireUser(req, res);
  if (!user) return;

  if (!isConfigured()) {
    return res.status(503).json({
      error: "PayPal is not configured. Add PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET to your .env.",
    });
  }

  const { packageKey } = req.body || {};
  const pkg = findPackage(packageKey);
  if (!pkg) return res.status(400).json({ error: "Unknown package." });

  try {
    const { id, approveUrl } = await createOrder({ pkg, user });

    // Pre-record the pending payment so we can correlate on capture
    await prisma.payment.create({
      data: {
        userId: user.id,
        provider: "paypal",
        providerTxId: id,
        amount: pkg.amount,
        currency: pkg.currency,
        status: "pending",
        packageKey: pkg.key,
      },
    });

    res.json({ id, approveUrl });
  } catch (e) {
    console.error("PayPal create error:", e);
    res.status(500).json({ error: e.message });
  }
}
