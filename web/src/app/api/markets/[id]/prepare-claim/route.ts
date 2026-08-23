import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireFan } from "@/lib/fanAuth";
import { marketConfigured, buildClaimTx } from "@/lib/stellar";
import { createTxIntent } from "@/lib/txIntents";

// STEP 1 of a payout: build the unsigned claim() tx for a winner to sign in Freighter.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = requireFan(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await ctx.params;
  const market = await db.predictionMarket.findUnique({ where: { id } });
  if (!market) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (market.status !== "resolved") return NextResponse.json({ error: "not_resolved" }, { status: 409 });
  if (!marketConfigured() || market.chainMarketId == null) return NextResponse.json({ error: "not_onchain" }, { status: 409 });

  // Require an unclaimed winning position.
  const winning = await db.prediction.findFirst({
    where: { marketId: id, fanId: auth.fanId, option: market.winningOption ?? -1, status: "won" },
  });
  if (!winning) return NextResponse.json({ error: "nothing_to_claim" }, { status: 409 });

  try {
    const { xdr, txHash } = await buildClaimTx({ fanAddress: auth.address, marketId: market.chainMarketId });
    const intent = createTxIntent({ kind: "market-claim", fanId: auth.fanId, marketId: id, expectedSource: auth.address, txHash });
    return NextResponse.json({ xdr, intentId: intent.id });
  } catch (e: any) {
    console.error("[api/markets/prepare-claim] failed:", e);
    return NextResponse.json({ error: e?.message ?? "prepare_failed" }, { status: 500 });
  }
}
