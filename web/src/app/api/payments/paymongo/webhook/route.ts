import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { mintPageantNft, mintCollectible } from "@/lib/stellar";

// PayMongo webhook — fires when a GCash (or card) payment clears. We verify the signature, then
// fulfill the order encoded in reference_number ("mint:<collectibleId>:<fanId>") by minting the NFT.
// Configure this URL in the PayMongo dashboard and set PAYMONGO_WEBHOOK_SECRET.
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const secret = process.env.PAYMONGO_WEBHOOK_SECRET;
  const sigHeader = req.headers.get("paymongo-signature");

  // Payment fulfillment must fail closed. Without a configured webhook secret an attacker could
  // otherwise forge a "paid" event and trigger a mint. PayMongo signs `timestamp.rawBody`.
  if (!secret) {
    console.error("[paymongo webhook] PAYMONGO_WEBHOOK_SECRET is not configured");
    return NextResponse.json({ error: "webhook_not_configured" }, { status: 503 });
  }
  if (!sigHeader) return NextResponse.json({ error: "no_signature" }, { status: 401 });
  const parts = Object.fromEntries(sigHeader.split(",").map((p) => p.trim().split("=", 2)));
  const timestamp = Number(parts.t);
  if (!Number.isFinite(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > 300) {
    return NextResponse.json({ error: "stale_signature" }, { status: 401 });
  }
  const expected = crypto.createHmac("sha256", secret).update(`${parts.t}.${raw}`).digest("hex");
  const provided = parts.li || parts.te || "";
  if (provided.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected))) {
    return NextResponse.json({ error: "bad_signature" }, { status: 401 });
  }

  let event: any;
  try { event = JSON.parse(raw); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  const type = event?.data?.attributes?.type;
  if (type !== "checkout_session.payment.paid") return NextResponse.json({ ok: true, ignored: type });

  const ref: string = event?.data?.attributes?.data?.attributes?.reference_number ?? "";
  const [kind, collectibleId, fanId] = ref.split(":");
  if (kind !== "mint" || !collectibleId || !fanId) return NextResponse.json({ ok: true, note: "no fulfillable reference" });

  try {
    const [fan, collectible, already] = await Promise.all([
      db.fan.findUnique({ where: { id: fanId } }),
      db.collectible.findUnique({ where: { id: collectibleId } }),
      db.purchase.findFirst({ where: { fanId, collectibleId } }),
    ]);
    if (already) return NextResponse.json({ ok: true, note: "already fulfilled" }); // idempotent
    if (!fan?.walletAddress || !collectible) return NextResponse.json({ ok: true, note: "missing fan/collectible" });

    const mint = collectible.candidateId != null
      ? await mintPageantNft({ toAddress: fan.walletAddress, candidateId: collectible.candidateId })
      : await mintCollectible({ toAddress: fan.walletAddress, metadataUri: collectible.metadataUri });
    await db.purchase.create({ data: { fanId, collectibleId, priceUsdc: collectible.priceUsdc, tokenId: mint.tokenId, mintTx: mint.txHash } });
    await db.paymentLog.create({ data: { fanId, kind: "mint", provider: "gcash", amount: collectible.priceUsdc, currency: "PHP", status: "success" } }).catch(() => {});
    return NextResponse.json({ ok: true, minted: mint.tokenId });
  } catch (e: any) {
    console.error("[paymongo webhook] fulfill failed:", e?.message ?? e);
    return NextResponse.json({ error: "fulfill_failed" }, { status: 500 });
  }
}
