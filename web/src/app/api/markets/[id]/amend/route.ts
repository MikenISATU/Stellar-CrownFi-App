import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readAdminSession } from "@/lib/adminAuth";
import { readFanSession } from "@/lib/fanAuth";
import { parseMarketInput, parseOptions, parseOptionFlags } from "@/lib/markets";
import { validAmendment } from "@/lib/predictionUpdates";
import { marketConfigured, supportsMarketAmendment, predictionMarketContractId, amendMarketOnchain } from "@/lib/stellar";
import { rateLimit } from "@/lib/ratelimit";
import { clientIp } from "@/lib/ip";

type Pending = { options: string[]; optionFlags: (string | null)[]; closeTime: string };
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = readAdminSession(req);
  const fan = readFanSession(req);
  if (!admin && !fan) return NextResponse.json({ error: "fan_auth_required" }, { status: 401 });
  if (!rateLimit(`market-manage:${clientIp(req)}`, 5, 60_000).ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const { id } = await ctx.params;
  const market = await db.predictionMarket.findUnique({ where: { id } });
  if (!market) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!admin && market.creatorFanId !== fan?.fanId) return NextResponse.json({ error: "not_market_creator" }, { status: 403 });
  // A chain-bound market must never silently fall back to a database-only amendment.
  const onchain = market.chainMarketId != null;
  if (onchain && (!marketConfigured() || !supportsMarketAmendment(market.createTxHash))) {
    return NextResponse.json({ error: "market_amendment_unsupported" }, { status: 409 });
  }
  const body = await req.json().catch(() => null);
  let pending: Pending;
  if (market.status === "amending" && market.amendmentJson) {
    if (body?.retry !== true) return NextResponse.json({ error: "market_amendment_pending" }, { status: 409 });
    pending = JSON.parse(market.amendmentJson) as Pending;
  } else {
    if (market.status !== "open" || market.closeTime.getTime() <= Date.now()) return NextResponse.json({ error: "market_closed" }, { status: 409 });
    const parsed = parseMarketInput({ question: market.question, category: market.category, ...body });
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const input = parsed.value;
    if (!validAmendment({ options: parseOptions(market.optionsJson), flags: parseOptionFlags(market.optionFlagsJson), closeTime: market.closeTime }, { options: input.options, flags: input.optionFlags, closeTime: input.closeTime })) {
      return NextResponse.json({ error: "market_append_extend_only" }, { status: 400 });
    }
    if (input.options.length === parseOptions(market.optionsJson).length && input.closeTime.getTime() === market.closeTime.getTime()) return NextResponse.json({ ok: true });
    pending = { options: input.options, optionFlags: input.optionFlags, closeTime: input.closeTime.toISOString() };
    const locked = await db.predictionMarket.updateMany({
      where: { id, status: "open", optionsJson: market.optionsJson, closeTime: market.closeTime },
      data: { status: "amending", amendmentJson: JSON.stringify(pending) },
    });
    if (locked.count !== 1) return NextResponse.json({ error: "market_changed" }, { status: 409 });
  }
  try {
    // Persist intent before sending. If chain submission or DB confirmation is uncertain,
    // retain the locked intent. Retrying the identical on-chain operation is safe.
    const result = onchain ? await amendMarketOnchain({ contractId: predictionMarketContractId(market.createTxHash), marketId: market.chainMarketId!, numOptions: pending.options.length, closeUnix: Math.floor(new Date(pending.closeTime).getTime() / 1000) }) : null;
    await db.predictionMarket.updateMany({
      where: { id, status: "amending", amendmentJson: JSON.stringify(pending) },
      data: { optionsJson: JSON.stringify(pending.options), optionFlagsJson: JSON.stringify(pending.optionFlags), closeTime: new Date(pending.closeTime), status: "open", amendmentJson: null, amendTxHash: result?.txHash },
    });
    return NextResponse.json({ ok: true, txHash: result?.txHash });
  } catch {
    return NextResponse.json({ error: "market_amendment_pending" }, { status: 502 });
  }
}
