import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireFan } from "@/lib/fanAuth";
import { parseOptions } from "@/lib/markets";
import { validRanking } from "@/lib/predictionUpdates";
import { rateLimit } from "@/lib/ratelimit";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const fan = requireFan(req);
  if (fan instanceof NextResponse) return fan;
  const { id } = await ctx.params;
  const rankings = await db.personalRanking.findMany({ where: { marketId: id, fanId: fan.fanId } });
  return NextResponse.json({ rankings }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const fan = requireFan(req);
  if (fan instanceof NextResponse) return fan;
  if (!rateLimit(`ranking:${fan.fanId}`, 30, 60_000).ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const market = await db.predictionMarket.findUnique({ where: { id } });
  if (!market) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (market.status !== "open" || market.closeTime.getTime() <= Date.now()) return NextResponse.json({ error: "market_closed" }, { status: 409 });
  const labels = parseOptions(market.optionsJson);
  if (!validRanking(body?.size, body?.options, labels.length)) return NextResponse.json({ error: "invalid_ranking" }, { status: 400 });
  const selectedLabels = body.options.map((index: number) => labels[index]);
  if (JSON.stringify(body.labels) !== JSON.stringify(selectedLabels)) return NextResponse.json({ error: "market_changed" }, { status: 409 });
  // Serialize against edits, and reject if terms changed between read and save.
  const result = await db.$transaction(async (tx) => {
    const locked = await tx.predictionMarket.updateMany({
      where: { id, status: "open", closeTime: { gt: new Date() }, optionsJson: market.optionsJson },
      data: { status: "open" },
    });
    if (!locked.count) return null;
    return tx.personalRanking.upsert({
      where: { marketId_fanId_size: { marketId: id, fanId: fan.fanId, size: body.size } },
      create: { marketId: id, fanId: fan.fanId, size: body.size, options: body.options, labels: selectedLabels },
      update: { options: body.options, labels: selectedLabels },
    });
  });
  if (!result) return NextResponse.json({ error: "market_changed" }, { status: 409 });
  return NextResponse.json({ ok: true, ranking: result });
}
