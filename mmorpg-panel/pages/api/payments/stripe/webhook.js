// POST /api/payments/stripe/webhook — Stripe → fulfillment
//
// Configure in your Stripe dashboard:
//   URL:     https://your-site.com/api/payments/stripe/webhook
//   Events:  checkout.session.completed, payment_intent.payment_failed
//   Secret:  copy to STRIPE_WEBHOOK_SECRET in .env
import { constructWebhookEvent } from "@/lib/payments/stripe";
import { fulfillPayment } from "@/lib/payments/fulfill";
import { findPackage } from "@/lib/payments/packages";

// Stripe needs the raw body to verify signatures, so disable Next's parser.
export const config = {
  api: { bodyParser: false },
};

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).end();
  }
  const sig = req.headers["stripe-signature"];
  if (!sig) return res.status(400).send("Missing signature");

  let event;
  try {
    const raw = await readRawBody(req);
    event = constructWebhookEvent(raw, sig);
  } catch (err) {
    console.error("Stripe webhook signature failure:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const userId = parseInt(session.metadata?.userId, 10);
      const packageKey = session.metadata?.packageKey;
      const pkg = findPackage(packageKey);
      if (userId && pkg) {
        await fulfillPayment({
          userId,
          provider: "stripe",
          providerTxId: session.id,
          packageKey,
          amount: (session.amount_total || 0) / 100,
          currency: (session.currency || "usd").toUpperCase(),
        });
      }
    }
    res.json({ received: true });
  } catch (err) {
    console.error("Stripe fulfillment error:", err);
    res.status(500).json({ error: err.message });
  }
}
