import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireFan } from "@/lib/fanAuth";
import { marketConfigured, buildUnstakeTx, predictionMarketContractId } from "@/lib/stellar";
import { createTxIntent } from "@/lib/txIntents";

// STEP 1 of cancelling a position: build the unsigned unstake() tx for the fan to sign.
// Only valid while the market is open (on-chain enforces before-close too).
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = requireFan(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await ctx.params;
  const b = await req.json().catch(() => null);
  const option = Number(b?.option);
  if (!Number.isInteger(option) || option < 0) return NextResponse.json({ error: "invalid_option" }, { status: 400 });

  const market = await db.predictionMarket.findUnique({ where: { id } });
  if (!market) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (market.status !== "open" || market.closeTime.getTime() <= Date.now()) return NextResponse.json({ error: "market_closed" }, { status: 409 });

  const pos = await db.prediction.findFirst({ where: { marketId: id, fanId: auth.fanId, option, status: "active" } });
  if (!pos) return NextResponse.json({ error: "nothing_to_unstake" }, { status: 409 });

  // Off-chain market: the stake was recorded via the mock /predict path (no USDC moved), so
  // the cancel is a plain DB reversal — nothing to sign. Mirrors the stake path's mock branch.
  if (!marketConfigured() || market.chainMarketId == null) {
    await db.prediction.deleteMany({ where: { marketId: id, fanId: auth.fanId, option, status: "active" } });
    return NextResponse.json({ mock: true, ok: true });
  }

  try {
    const { xdr, txHash } = await buildUnstakeTx({ contractId: predictionMarketContractId(market.createTxHash), fanAddress: auth.address, marketId: market.chainMarketId, option });
    const intent = createTxIntent({ kind: "market-unstake", fanId: auth.fanId, marketId: id, option, expectedSource: auth.address, txHash });
    return NextResponse.json({ xdr, intentId: intent.id });
  } catch (e: any) {
    console.error("[api/markets/prepare-unstake] failed:", e);
    return NextResponse.json({ error: e?.message ?? "prepare_failed" }, { status: 500 });
  }
}
