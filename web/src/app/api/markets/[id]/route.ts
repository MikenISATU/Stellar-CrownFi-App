import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readFanSession } from "@/lib/fanAuth";
import { readAdminSession } from "@/lib/adminAuth";
import { computeMarketView, parseMarketInput } from "@/lib/markets";
import { cancelMarketOnchain, createMarketOnchain, marketConfigured } from "@/lib/stellar";
import { rateLimit } from "@/lib/ratelimit";
import { clientIp } from "@/lib/ip";

// GET — market detail: view (pools/odds) + recent activity + the caller's own positions.
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const m = await db.predictionMarket.findUnique({
      where: { id },
      include: { predictions: { orderBy: { createdAt: "desc" } } },
    });
    if (!m) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const view = computeMarketView(m, m.predictions);
    const activity = m.predictions.slice(0, 25).map((p) => ({ option: p.option, amount: p.amount, createdAt: p.createdAt, status: p.status }));

    const fan = readFanSession(req);
    const admin = readAdminSession(req);
    const mine = fan ? m.predictions.filter((p) => p.fanId === fan.fanId).map((p) => ({ option: p.option, amount: p.amount, status: p.status })) : [];
    const isCreator = Boolean(fan && m.creatorFanId === fan.fanId);
    const canManage = Boolean(admin || isCreator);
    const hasPositions = m.predictions.length > 0;

    // Odds time-series (Polymarket-style): replay stakes in order → each option's % over time.
    const n = view.options.length;
    const asc = [...m.predictions].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const pools = new Array(n).fill(0);
    let series = asc.map((p) => {
      if (p.option >= 0 && p.option < n) pools[p.option] += p.amount;
      const total = pools.reduce((a, b) => a + b, 0);
      return { t: p.createdAt.getTime(), pcts: pools.map((x) => (total > 0 ? Math.round((x / total) * 1000) / 10 : 0)) };
    });
    // Downsample to keep the payload light on very active markets.
    if (series.length > 60) {
      const step = Math.ceil(series.length / 60);
      series = series.filter((_, i) => i % step === 0 || i === series.length - 1);
    }

    return NextResponse.json({ ...view, activity, mine, series, isCreator, canManage, canEdit: canManage && m.status === "open" && !hasPositions, hasPositions });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

// PATCH — the creator (or an admin) may replace an OPEN market only before its first
// position. On-chain terms are immutable, so the empty old contract market is cancelled
// and replaced. This prevents changing the meaning of a position after someone stakes.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = readAdminSession(req);
  const fan = readFanSession(req);
  if (!admin && !fan) return NextResponse.json({ error: "fan_auth_required" }, { status: 401 });

  const limiter = rateLimit(`market-manage:${clientIp(req)}`, 5, 60_000);
  if (!limiter.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const body = await req.json().catch(() => null);
  const parsed = parseMarketInput(body);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const input = parsed.value;
  const { id } = await ctx.params;

  const market = await db.predictionMarket.findUnique({
    where: { id },
    include: { _count: { select: { predictions: true } } },
  });
  if (!market) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!admin && market.creatorFanId !== fan?.fanId) return NextResponse.json({ error: "not_market_creator" }, { status: 403 });
  if (market.status !== "open") return NextResponse.json({ error: "market_not_editable" }, { status: 409 });
  if (market._count.predictions > 0) return NextResponse.json({ error: "market_has_positions" }, { status: 409 });

  // Lock prepare/confirm-stake while the old on-chain market is being replaced.
  const locked = await db.predictionMarket.updateMany({
    where: { id, status: "open", predictions: { none: {} } },
    data: { status: "editing" },
  });
  if (locked.count !== 1) return NextResponse.json({ error: "market_has_positions" }, { status: 409 });

  const onchain = marketConfigured() && market.chainMarketId != null;
  let cancelTxHash: string | null = null;
  try {
    if (onchain) {
      cancelTxHash = (await cancelMarketOnchain({ marketId: market.chainMarketId! })).txHash;
      // Persist the irreversible chain state before attempting the replacement.
      await db.predictionMarket.update({ where: { id }, data: { status: "cancelled", resolveTxHash: cancelTxHash } });

      const racedPositions = await db.prediction.count({ where: { marketId: id } });
      if (racedPositions > 0) {
        await db.prediction.updateMany({ where: { marketId: id }, data: { status: "lost" } });
        return NextResponse.json({ error: "market_cancelled_has_positions", cancelTxHash }, { status: 409 });
      }

      const replacement = await createMarketOnchain({
        question: input.question,
        category: input.category,
        numOptions: input.options.length,
        closeUnix: Math.floor(input.closeTime.getTime() / 1000),
      });
      const updated = await db.predictionMarket.update({
        where: { id },
        data: {
          question: input.question,
          category: input.category,
          optionsJson: JSON.stringify(input.options),
          optionFlagsJson: input.optionFlags.some(Boolean) ? JSON.stringify(input.optionFlags) : null,
          closeTime: input.closeTime,
          pageantId: input.pageantId,
          bannerUrl: input.bannerUrl,
          status: "open",
          chainMarketId: replacement.marketId,
          createTxHash: replacement.txHash,
          resolveTxHash: null,
        },
      });
      return NextResponse.json({ ok: true, market: updated, replacedOnchain: true, cancelTxHash });
    }

    const updated = await db.predictionMarket.update({
      where: { id },
      data: {
        question: input.question,
        category: input.category,
        optionsJson: JSON.stringify(input.options),
        optionFlagsJson: input.optionFlags.some(Boolean) ? JSON.stringify(input.optionFlags) : null,
        closeTime: input.closeTime,
        pageantId: input.pageantId,
        bannerUrl: input.bannerUrl,
        status: "open",
      },
    });
    return NextResponse.json({ ok: true, market: updated, replacedOnchain: false });
  } catch (error) {
    console.error("[markets/edit] failed:", error);
    if (cancelTxHash) {
      await db.predictionMarket.updateMany({ where: { id, status: "editing" }, data: { status: "cancelled", resolveTxHash: cancelTxHash } }).catch(() => {});
      return NextResponse.json({ error: "market_replacement_failed", cancelTxHash }, { status: 502 });
    }
    await db.predictionMarket.updateMany({ where: { id, status: "editing" }, data: { status: "open" } }).catch(() => {});
    return NextResponse.json({ error: onchain ? "onchain_failed" : "market_update_failed" }, { status: 500 });
  }
}

// DELETE — the creator (or an admin) can permanently remove an empty market. Soroban
// records are immutable, so an open on-chain market is cancelled before its DB row is removed.
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = readAdminSession(req);
  const fan = readFanSession(req);
  if (!admin && !fan) return NextResponse.json({ error: "fan_auth_required" }, { status: 401 });
  const limiter = rateLimit(`market-manage:${clientIp(req)}`, 5, 60_000);
  if (!limiter.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const { id } = await ctx.params;
  try {
    const market = await db.predictionMarket.findUnique({
      where: { id },
      include: { _count: { select: { predictions: true } } },
    });
    if (!market) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (!admin && market.creatorFanId !== fan?.fanId) return NextResponse.json({ error: "not_market_creator" }, { status: 403 });
    if (market._count.predictions > 0) {
      return NextResponse.json({ error: "market_has_positions_use_cancel" }, { status: 409 });
    }

    const previousStatus = market.status;
    const locked = await db.predictionMarket.updateMany({
      where: { id, status: previousStatus, predictions: { none: {} } },
      data: { status: "deleting" },
    });
    if (locked.count !== 1) return NextResponse.json({ error: "market_has_positions_use_cancel" }, { status: 409 });

    let cancelTxHash: string | undefined;
    if (previousStatus === "open" && marketConfigured() && market.chainMarketId != null) {
      try {
        cancelTxHash = (await cancelMarketOnchain({ marketId: market.chainMarketId })).txHash;
      } catch (error) {
        console.error("[markets/delete] cancel on-chain failed:", error);
        await db.predictionMarket.updateMany({ where: { id, status: "deleting" }, data: { status: previousStatus } }).catch(() => {});
        return NextResponse.json({ error: "onchain_failed" }, { status: 502 });
      }
    }

    // The relation filter closes the race between the initial count and deletion.
    const removed = await db.predictionMarket.deleteMany({
      where: { id, predictions: { none: {} } },
    });
    if (removed.count !== 1) {
      await db.predictionMarket.updateMany({
        where: { id, status: "deleting" },
        data: { status: cancelTxHash ? "cancelled" : previousStatus, resolveTxHash: cancelTxHash },
      }).catch(() => {});
      return NextResponse.json(
        { error: cancelTxHash ? "market_cancelled_has_positions" : "market_has_positions", cancelTxHash },
        { status: 409 },
      );
    }

    return NextResponse.json({ ok: true, cancelTxHash });
  } catch (error) {
    console.error("[markets/delete] failed:", error);
    return NextResponse.json({ error: "market_delete_failed" }, { status: 500 });
  }
}
