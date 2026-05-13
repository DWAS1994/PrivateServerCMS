// PayPal payment provider — uses the REST v2 Orders API directly.
// Configure via PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_API_BASE in .env.

const API_BASE = process.env.PAYPAL_API_BASE || "https://api-m.sandbox.paypal.com";

export function isConfigured() {
  return !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

async function getAccessToken() {
  if (!isConfigured()) throw new Error("PayPal is not configured");
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  const auth = Buffer.from(`${id}:${secret}`).toString("base64");
  const res = await fetch(`${API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`PayPal auth failed: ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

// Create a PayPal order. Returns { id, approveUrl }.
export async function createOrder({ pkg, user }) {
  const token = await getAccessToken();
  const res = await fetch(`${API_BASE}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: `${user.id}:${pkg.key}`,
          description: pkg.name,
          amount: {
            currency_code: pkg.currency,
            value: pkg.amount.toFixed(2),
          },
        },
      ],
      application_context: {
        brand_name: process.env.NEXT_PUBLIC_SITE_NAME || "MMORPG Panel",
        return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/api/payments/paypal/capture`,
        cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/donate?cancelled=1`,
        user_action: "PAY_NOW",
      },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PayPal create order failed: ${err}`);
  }
  const data = await res.json();
  const approveUrl = data.links.find((l) => l.rel === "approve")?.href;
  return { id: data.id, approveUrl };
}

// Capture a PayPal order after the buyer approves it
export async function captureOrder(orderId) {
  const token = await getAccessToken();
  const res = await fetch(`${API_BASE}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PayPal capture failed: ${err}`);
  }
  return res.json();
}
