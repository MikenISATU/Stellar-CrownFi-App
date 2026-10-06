// GCash checkout via PayMongo (the PH gateway that exposes GCash as a payment method).
// Everything here is a no-op until PAYMONGO_SECRET_KEY is set, so it's safe to ship disabled.
//
// Flow: createGcashCheckout() → PayMongo Checkout Session (payment_method_types: ["gcash"])
//   → returns a hosted checkout_url → redirect the buyer → they pay in GCash
//   → PayMongo POSTs a webhook (checkout_session.payment.paid) to /api/payments/paymongo/webhook
//   → we verify + fulfill (mint / issue ticket).

const PAYMONGO_BASE = "https://api.paymongo.com/v1";

export function gcashConfigured(): boolean {
  return Boolean(process.env.PAYMONGO_SECRET_KEY);
}

// USD→PHP for display/charge. GCash settles in PHP; the catalog is priced in USDC (≈USD).
function usdToCentavos(usd: number): number {
  const rate = Number(process.env.PHP_PER_USD ?? "58"); // set a real/looked-up FX rate before going live
  return Math.round(usd * rate * 100); // PayMongo amounts are in centavos
}

export type GcashCheckout = { id: string; url: string };

export async function createGcashCheckout(input: {
  amountUsd: number;
  description: string;
  referenceNumber: string; // your order id — echoed back in the webhook so you can fulfill
  successUrl: string;
  cancelUrl: string;
}): Promise<GcashCheckout> {
  const key = process.env.PAYMONGO_SECRET_KEY;
  if (!key) throw new Error("gcash_not_configured");

  const auth = Buffer.from(`${key}:`).toString("base64");
  const res = await fetch(`${PAYMONGO_BASE}/checkout_sessions`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      data: {
        attributes: {
          payment_method_types: ["gcash"],
          line_items: [{ name: input.description, amount: usdToCentavos(input.amountUsd), currency: "PHP", quantity: 1 }],
          reference_number: input.referenceNumber,
          description: input.description,
          success_url: input.successUrl,
          cancel_url: input.cancelUrl,
        },
      },
    }),
  });
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.errors?.[0]?.detail ?? "paymongo_error");
  const url = body?.data?.attributes?.checkout_url;
  const id = body?.data?.id;
  if (!url) throw new Error("no_checkout_url");
  return { id, url };
}
