// GET /api/payments/paypal/capture?token=... — return URL after PayPal approval
import { prisma } from "@/lib/prisma";
import { captureOrder, isConfigured } from "@/lib/payments/paypal";
import { fulfillPayment } from "@/lib/payments/fulfill";

export default async function handler(req, res) {
  const orderId = req.query.token;
  if (!orderId) return res.status(400).send("Missing order token");
  if (!isConfigured()) return res.status(503).send("PayPal not configured");

  try {
    const result = await captureOrder(orderId);
    const status = result.status; // COMPLETED | etc.

    if (status === "COMPLETED") {
      // Find the pending payment we pre-created and fulfill it
      const pending = await prisma.payment.findUnique({
        where: { providerTxId: orderId },
      });
      if (pending && pending.packageKey) {
        await fulfillPayment({
          userId: pending.userId,
          provider: "paypal",
          providerTxId: orderId,
          packageKey: pending.packageKey,
          amount: pending.amount,
          currency: pending.currency,
        });
      }
      return res.redirect(303, "/donate?success=1");
    }

    res.redirect(303, "/donate?cancelled=1");
  } catch (e) {
    console.error("PayPal capture error:", e);
    res.redirect(303, "/donate?error=1");
  }
}
