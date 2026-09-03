import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireFan } from "@/lib/fanAuth";
import { parseOptions } from "@/lib/markets";
import { marketConfigured, buildStakeTx, predictionMarketContractId } from "@/lib/stellar";
import { createTxIntent } from "@/lib/txIntents";
import { rateLimit } from "@/lib/ratelimit";
import { clientIp } from "@/lib/ip";

// STEP 1 of an on-chain prediction: build the unsigned stake() tx for the fan to sign in
// Freighter (the fan is the source, so their signature authorizes the USDC transfer into escrow).
// Off-chain/mock markets return { mock:true } so the client falls back to the direct predict route.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = requireFan(req);
  if (auth instanceof NextResponse) return auth;

  const rl = rateLimit(`predict:${clientIp(req)}`);
  if (!rl.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const { id } = await ctx.params;
  const b = await req.json().catch(() => null);
  const option = Number(b?.option);
  const amount = Number(b?.amount);
  if (!Number.isInteger(option) || option < 0) return NextResponse.json({ error: "invalid_option" }, { status: 400 });
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "invalid_amount" }, { status: 400 });

  const market = await db.predictionMarket.findUnique({ where: { id } });
  if (!market) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (market.status !== "open" || market.closeTime.getTime() <= Date.now()) return NextResponse.json({ error: "market_closed" }, { status: 409 });
  if (option >= parseOptions(market.optionsJson).length) return NextResponse.json({ error: "invalid_option" }, { status: 400 });

  if (!marketConfigured() || market.chainMarketId == null) return NextResponse.json({ mock: true });

  try {
    const { xdr, txHash } = await buildStakeTx({ contractId: predictionMarketContractId(market.createTxHash), fanAddress: auth.address, marketId: market.chainMarketId, option, amountUsdc: amount });
    const intent = createTxIntent({ kind: "market-stake", fanId: auth.fanId, marketId: id, option, amountUsdc: amount, expectedSource: auth.address, txHash });
    return NextResponse.json({ xdr, intentId: intent.id });
  } catch (e: any) {
    console.error("[api/markets/prepare-stake] failed:", e);
    // A simulation failure here is usually "no USDC / no trustline".
    return NextResponse.json({ error: e?.message ?? "prepare_failed" }, { status: 500 });
  }
}
