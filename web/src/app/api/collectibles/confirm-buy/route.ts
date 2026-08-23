import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { submitSignedXdr, mintCollectible, mintPageantNft } from "@/lib/stellar";
import { consumeTxIntent } from "@/lib/txIntents";
import { requireFan } from "@/lib/fanAuth";
import { tryAwardPoints, COLLECTIBLE_POINTS } from "@/lib/loyalty";

// STEP 2 of a USDC purchase: submit the buyer's signed transaction (the USDC split), then mint the
// collectible NFT to them and record the purchase (+10 loyalty points).
export async function POST(req: NextRequest) {
  const auth = requireFan(req);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  const collectibleId = String(body?.collectibleId ?? "");
  const fanId = auth.fanId;
  const signedXdr = String(body?.signedXdr ?? "");
  const intentId = String(body?.intentId ?? "");
  if (!collectibleId || !signedXdr || !intentId)
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });

  const [fan, collectible] = await Promise.all([
    db.fan.findUnique({ where: { id: fanId } }),
    db.collectible.findUnique({ where: { id: collectibleId } }),
  ]);
  if (!fan || !collectible) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!fan.walletAddress) return NextResponse.json({ error: "no_wallet" }, { status: 400 });
  if (fan.walletAddress !== auth.address) return NextResponse.json({ error: "address_mismatch" }, { status: 403 });

  // One collectible per fan — blocks re-mint/point farming. Checked before payment.
  const owned = await db.purchase.findFirst({ where: { fanId: fan.id, collectibleId: collectible.id } });
  if (owned) return NextResponse.json({ error: "already_owned" }, { status: 409 });

  try {
    const intent = consumeTxIntent(intentId);
    if (!intent || intent.kind !== "collectible-buy" || intent.fanId !== fan.id || intent.collectibleId !== collectible.id) {
      return NextResponse.json({ error: "invalid_or_expired_intent" }, { status: 409 });
    }

    // 1) Submit the exact buyer-signed USDC split prepared by CrownFi.
    const payment = await submitSignedXdr(signedXdr, { source: fan.walletAddress, txHash: intent.txHash });
    // 2) Mint the NFT to the buyer (platform-signed). Prefer the pageant-nft contract (per-candidate
    //    metadata + one-per-wallet); fall back to the legacy collectible mint if no candidateId is set.
    const mint = collectible.candidateId != null
      ? await mintPageantNft({ toAddress: fan.walletAddress, candidateId: collectible.candidateId })
      : await mintCollectible({ toAddress: fan.walletAddress, metadataUri: collectible.metadataUri });
    // 3) Record the purchase + reward loyalty.
    const purchase = await db.purchase.create({
      data: { fanId: fan.id, collectibleId: collectible.id, priceUsdc: collectible.priceUsdc, tokenId: mint.tokenId, mintTx: mint.txHash },
    });
    await tryAwardPoints(fan.id, COLLECTIBLE_POINTS, "collectible");

    return NextResponse.json({ ok: true, purchase, paymentTx: payment.txHash, mintTx: mint.txHash });
  } catch (e: any) {
    console.error("[api/collectibles/confirm-buy] failed:", e);
    return NextResponse.json({ error: e?.message ?? "confirm_failed" }, { status: 500 });
  }
}
