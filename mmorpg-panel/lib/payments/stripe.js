// Stripe payment provider.
// Configure via STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET in .env.
import Stripe from "stripe";

let stripeClient = null;

export function getStripe() {
  if (stripeClient) return stripeClient;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key.startsWith("sk_test_...") || key === "") {
    return null; // not configured
  }
  stripeClient = new Stripe(key, { apiVersion: "2024-10-28.acacia" });
  return stripeClient;
}

export function isConfigured() {
  return getStripe() !== null;
}

// Create a Stripe Checkout session for a given package
export async function createCheckoutSession({ pkg, user, successUrl, cancelUrl }) {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe is not configured");

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: user.email,
    line_items: [
      {
        price_data: {
          currency: pkg.currency.toLowerCase(),
          product_data: {
            name: pkg.name,
            description: pkg.description,
          },
          unit_amount: Math.round(pkg.amount * 100),
        },
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      userId: String(user.id),
      packageKey: pkg.key,
    },
  });
  return session;
}

// Verify and parse a Stripe webhook event
export function constructWebhookEvent(rawBody, signature) {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe is not configured");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET not set");
  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}
