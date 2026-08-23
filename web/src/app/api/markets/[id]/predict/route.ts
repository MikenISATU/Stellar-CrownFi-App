import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireFan } from "@/lib/fanAuth";
import { parseOptions } from "@/lib/markets";
import { rateLimit } from "@/lib/ratelimit";
import { clientIp } from "@/lib/ip";
import { tryAwardPoints, PREDICT_POINTS } from "@/lib/loyalty";
import { marketConfigured } from "@/lib/stellar";

// POST — place a prediction (stake) on a market option. fanId from the verified session.
// In mock mode this records the stake; live mode also submits stake() on the contract.
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

  try {
    const market = await db.predictionMarket.findUnique({ where: { id } });
    if (!market) return NextResponse.json({ error: "not_found" }, { status: 404 });
    // On-chain markets must stake real USDC via prepare-stake/confirm-stake (Freighter-signed).
    if (marketConfigured() && market.chainMarketId != null) {
      return NextResponse.json({ error: "use_onchain_stake" }, { status: 409 });
    }
    if (market.status !== "open" || market.closeTime.getTime() <= Date.now()) {
      return NextResponse.json({ error: "market_closed" }, { status: 409 });
    }
    if (option >= parseOptions(market.optionsJson).length) return NextResponse.json({ error: "invalid_option" }, { status: 400 });

    const prediction = await db.prediction.create({
      data: { marketId: id, fanId: auth.fanId, option, amount },
    });
    await tryAwardPoints(auth.fanId, PREDICT_POINTS, "predict");
    return NextResponse.json({ ok: true, prediction, pointsAwarded: PREDICT_POINTS });
  } catch (e) {
    console.error("[api/markets/predict] failed:", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
