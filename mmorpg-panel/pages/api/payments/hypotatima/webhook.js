// POST /api/payments/hypotatima/webhook — Hypotatima → fulfillment
import { prisma } from "@/lib/prisma";
import { verifyWebhookSignature } from "@/lib/payments/hypotatima";
import { fulfillPayment } from "@/lib/payments/fulfill";

export const config = { api: { bodyParser: false } };

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const raw = await readRawBody(req);
  const signature = req.headers["x-hypotatima-signature"];
  if (!verifyWebhookSignature(raw, signature)) {
    return res.status(400).send("Invalid signature");
  }

  let event;
  try {
    event = JSON.parse(raw.toString("utf8"));
  } catch {
    return res.status(400).send("Bad JSON");
  }

  // The exact event shape depends on Hypotatima's API — adjust the field
  // names below to match their docs.
  if (event.type === "transaction.completed" || event.status === "completed") {
    const txId = event.transaction_id || event.id || event.reference;
    const payment = await prisma.payment.findUnique({ where: { providerTxId: txId } });
    if (payment && payment.packageKey) {
      try {
        await fulfillPayment({
          userId: payment.userId,
          provider: "hypotatima",
          providerTxId: txId,
          packageKey: payment.packageKey,
          amount: payment.amount,
          currency: payment.currency,
        });
      } catch (e) {
        console.error("Hypotatima fulfillment error:", e);
        return res.status(500).json({ error: e.message });
      }
    }
  }

  res.json({ received: true });
}
