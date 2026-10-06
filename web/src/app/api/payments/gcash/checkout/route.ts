import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireFan } from "@/lib/fanAuth";
import { paymentsAllowed } from "@/lib/settings";
import { gcashConfigured, createGcashCheckout } from "@/lib/payments/gcash";
import { canonicalAppOrigin } from "@/lib/appOrigin";

// Start a GCash (PayMongo) checkout for a collectible. Returns a hosted URL to redirect to.
// Fulfillment (minting) happens later from the PayMongo webhook once payment clears.
export async function POST(req: NextRequest) {
  const auth = requireFan(req);
  if (auth instanceof NextResponse) return auth;

  const pay = await paymentsAllowed();
  if (!pay.ok) return NextResponse.json({ error: pay.reason }, { status: 403 });
  if (!gcashConfigured()) return NextResponse.json({ error: "gcash_not_configured" }, { status: 501 });

  const b = await req.json().catch(() => null);
  const collectibleId = String(b?.collectibleId ?? "");
  const collectible = await db.collectible.findUnique({ where: { id: collectibleId } });
  if (!collectible) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const origin = canonicalAppOrigin(req);
  try {
    const checkout = await createGcashCheckout({
      amountUsd: collectible.priceUsdc,
      description: collectible.title,
      referenceNumber: `mint:${collectible.id}:${auth.fanId}`, // echoed back in the webhook
      successUrl: `${origin}/me?paid=1`,
      cancelUrl: `${origin}/contestants/${collectible.contestantId}`,
    });
    // Record the pending attempt for the admin monitor / reconciliation.
    await db.paymentLog.create({ data: { fanId: auth.fanId, kind: "mint", provider: "gcash", amount: collectible.priceUsdc, currency: "PHP", status: "pending" } }).catch(() => {});
    return NextResponse.json({ url: checkout.url });
  } catch (e: any) {
    console.error("[api/payments/gcash/checkout] failed:", e?.message ?? e);
    return NextResponse.json({ error: e?.message ?? "gcash_error" }, { status: 502 });
  }
}
