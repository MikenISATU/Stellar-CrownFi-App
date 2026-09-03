import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readFanSession } from "@/lib/fanAuth";
import { readAdminSession } from "@/lib/adminAuth";
import { computeMarketView, parseMarketInput } from "@/lib/markets";
import {
  cancelMarketOnchain,
  createMarketOnchain,
  encodePredictionMarketCreateRef,
  forceRefundMarketOnchain,
  marketConfigured,
  predictionMarketContractId,
  supportsAdminForceRefund,
} from "@/lib/stellar";
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
      cancelTxHash = (await cancelMarketOnchain({ contractId: predictionMarketContractId(market.createTxHash), marketId: market.chainMarketId! })).txHash;
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
          createTxHash: encodePredictionMarketCreateRef(replacement.contractId, replacement.txHash),
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

// DELETE — creators can remove empty markets. Admins may add ?force=1: a V2 market is
// cancelled and every escrowed stake is sent directly back to its original wallet before
// deletion. Legacy markets remain cancelled/visible until users claim, because their
// deployed contract correctly requires the user's own signature for each refund.
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = readAdminSession(req);
  const fan = readFanSession(req);
  if (!admin && !fan) return NextResponse.json({ error: "fan_auth_required" }, { status: 401 });
  const limiter = rateLimit(`market-manage:${clientIp(req)}`, 5, 60_000);
  if (!limiter.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const { id } = await ctx.params;
  const force = Boolean(admin && req.nextUrl.searchParams.get("force") === "1");
  try {
    const market = await db.predictionMarket.findUnique({
      where: { id },
      include: { predictions: { select: { fanId: true, status: true } } },
    });
    if (!market) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (!admin && market.creatorFanId !== fan?.fanId) return NextResponse.json({ error: "not_market_creator" }, { status: 403 });
    if (["deleting", "cancelling"].includes(market.status)) {
      return NextResponse.json({ error: "market_changed" }, { status: 409 });
    }
    if (market.predictions.length > 0 && !force) {
      return NextResponse.json({ error: "market_has_positions_use_cancel" }, { status: 409 });
    }

    if (force && market.status === "resolved") {
      const payoutsPending = market.predictions.filter((prediction) => prediction.status === "won").length;
      if (payoutsPending > 0) {
        return NextResponse.json({ error: "market_payouts_pending", payoutsPending }, { status: 409 });
      }
      await db.predictionMarket.delete({ where: { id } });
      return NextResponse.json({ ok: true, deleted: true, resolved: true });
    }

    const previousStatus = market.status;
    const locked = await db.predictionMarket.updateMany({
      where: { id, status: previousStatus },
      data: { status: "deleting" },
    });
    if (locked.count !== 1) return NextResponse.json({ error: "market_changed" }, { status: 409 });

    let cancelTxHash: string | undefined;
    let autoRefunded = 0;
    const onchain = marketConfigured() && market.chainMarketId != null;
    const contractId = onchain ? predictionMarketContractId(market.createTxHash) : undefined;
    if (["open", "closed"].includes(previousStatus) && onchain) {
      try {
        cancelTxHash = (await cancelMarketOnchain({ contractId, marketId: market.chainMarketId! })).txHash;
      } catch (error) {
        console.error("[markets/delete] cancel on-chain failed:", error);
        await db.predictionMarket.updateMany({ where: { id, status: "deleting" }, data: { status: previousStatus } }).catch(() => {});
        return NextResponse.json({ error: "onchain_failed" }, { status: 502 });
      }
    }

    const unrefundedPredictions = market.predictions.filter((prediction) => prediction.status !== "claimed");
    if (unrefundedPredictions.length > 0) {
      // Off-chain demo positions contain no escrow: mark them refunded before deletion.
      if (!onchain) {
        await db.prediction.updateMany({ where: { marketId: id }, data: { status: "claimed" } });
      } else if (!supportsAdminForceRefund(market.createTxHash)) {
        // Never pretend a v1 user-authorized refund happened. Keep the market available so
        // participants can sign the existing Claim full refund flow.
        await db.$transaction([
          db.predictionMarket.update({ where: { id }, data: { status: "cancelled", resolveTxHash: cancelTxHash } }),
          db.prediction.updateMany({ where: { marketId: id, status: { not: "claimed" } }, data: { status: "lost" } }),
        ]);
        const pendingRefunds = new Set(unrefundedPredictions.map((prediction) => prediction.fanId)).size;
        return NextResponse.json({
          error: "legacy_market_refunds_require_claim",
          cancelled: true,
          deleted: false,
          pendingRefunds,
          cancelTxHash,
        }, { status: 409 });
      } else {
        const fanIds = [...new Set(unrefundedPredictions.map((prediction) => prediction.fanId))];
        autoRefunded = fanIds.length;
        const owners = await db.fan.findMany({
          where: { id: { in: fanIds } },
          select: { id: true, walletAddress: true },
        });
        const ownerById = new Map(owners.map((owner) => [owner.id, owner.walletAddress]));
        const failures: string[] = [];

        for (const fanId of fanIds) {
          const walletAddress = ownerById.get(fanId);
          if (!walletAddress) {
            failures.push(fanId);
            continue;
          }
          try {
            const refund = await forceRefundMarketOnchain({ contractId: contractId!, fanAddress: walletAddress, marketId: market.chainMarketId! });
            await db.prediction.updateMany({
              where: { marketId: id, fanId, status: { not: "claimed" } },
              data: { status: "claimed", claimTxHash: refund.txHash },
            });
          } catch (error) {
            console.error(`[markets/force-delete] refund failed for fan ${fanId}:`, error);
            failures.push(fanId);
          }
        }

        if (failures.length > 0) {
          await db.$transaction([
            db.predictionMarket.update({ where: { id }, data: { status: "cancelled", resolveTxHash: cancelTxHash } }),
            db.prediction.updateMany({ where: { marketId: id, fanId: { in: failures }, status: { not: "claimed" } }, data: { status: "lost" } }),
          ]);
          return NextResponse.json({ error: "force_refund_incomplete", cancelled: true, refunded: fanIds.length - failures.length, pendingRefunds: failures.length }, { status: 502 });
        }
      }
    }

    await db.predictionMarket.delete({ where: { id } });
    return NextResponse.json({ ok: true, deleted: true, autoRefunded, cancelTxHash });
  } catch (error) {
    console.error("[markets/delete] failed:", error);
    return NextResponse.json({ error: "market_delete_failed" }, { status: 500 });
  }
}
