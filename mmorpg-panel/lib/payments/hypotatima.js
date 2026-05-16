// Hypotatima payment provider.
//
// This is a stub following the same shape as the Stripe and PayPal modules.
// Replace the API calls below with the real Hypotatima SDK or REST endpoints
// for your merchant account, then this provider will appear automatically on
// the donate page.
//
// Required env vars:
//   HYPOTATIMA_MERCHANT_ID
//   HYPOTATIMA_API_KEY
//   HYPOTATIMA_API_BASE   (e.g. "https://api.hypotatima.example/v1")

const API_BASE = process.env.HYPOTATIMA_API_BASE || "";

export function isConfigured() {
  return !!(
    process.env.HYPOTATIMA_MERCHANT_ID &&
    process.env.HYPOTATIMA_API_KEY &&
    API_BASE
  );
}

// Create a hosted-checkout session. Returns { id, redirectUrl }.
export async function createCheckout({ pkg, user, successUrl, cancelUrl }) {
  if (!isConfigured()) throw new Error("Hypotatima is not configured");

  const res = await fetch(`${API_BASE}/checkouts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.HYPOTATIMA_API_KEY}`,
      "Content-Type": "application/json",
      "X-Merchant-Id": process.env.HYPOTATIMA_MERCHANT_ID,
    },
    body: JSON.stringify({
      amount: Math.round(pkg.amount * 100),
      currency: pkg.currency,
      reference: `${user.id}:${pkg.key}:${Date.now()}`,
      description: pkg.name,
      customer: {
        email: user.email,
        external_id: String(user.id),
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId: String(user.id),
        packageKey: pkg.key,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Hypotatima checkout failed: ${err}`);
  }

  const data = await res.json();
  return {
    id: data.id || data.checkout_id,
    redirectUrl: data.redirect_url || data.url,
  };
}

// Verify a webhook signature. Replace with the real algorithm Hypotatima uses
// (HMAC-SHA256 of the raw body with your webhook secret is typical).
export function verifyWebhookSignature(_rawBody, _signature) {
  // TODO: implement real signature verification per Hypotatima's docs
  return true;
}

// Look up a transaction by ID
export async function getTransaction(txId) {
  if (!isConfigured()) throw new Error("Hypotatima is not configured");
  const res = await fetch(`${API_BASE}/transactions/${txId}`, {
    headers: {
      Authorization: `Bearer ${process.env.HYPOTATIMA_API_KEY}`,
      "X-Merchant-Id": process.env.HYPOTATIMA_MERCHANT_ID,
    },
  });
  if (!res.ok) throw new Error(`Hypotatima get-tx failed: ${res.status}`);
  return res.json();
}
