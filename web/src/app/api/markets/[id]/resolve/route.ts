import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readAdminSession } from "@/lib/adminAuth";
import { readFanSession } from "@/lib/fanAuth";
import { parseOptions } from "@/lib/markets";
import { marketConfigured, resolveMarketOnchain, closeMarketOnchain, cancelMarketOnchain } from "@/lib/stellar";
import { rateLimit } from "@/lib/ratelimit";
import { clientIp } from "@/lib/ip";

// POST — admins may close/resolve/cancel; a community creator may cancel their own market.
// body: { action: "close" | "resolve" | "cancel", winningOption?: number }
// Live mode mirrors each action onto the deployed contract (platform-signed) before the DB write.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const b = await req.json().catch(() => null);
  const action = String(b?.action ?? "");
  const admin = readAdminSession(req);
  const fan = readFanSession(req);
  if (!admin && !fan) return NextResponse.json({ error: "fan_auth_required" }, { status: 401 });

  const market = await db.predictionMarket.findUnique({ where: { id }, include: { predictions: true } });
  if (!market) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (action === "cancel") {
    if (!admin && market.creatorFanId !== fan?.fanId) return NextResponse.json({ error: "not_market_creator" }, { status: 403 });
    const limiter = rateLimit(`market-manage:${clientIp(req)}`, 5, 60_000);
    if (!limiter.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  } else if (!admin) {
    return NextResponse.json({ error: "admin_auth_required" }, { status: 403 });
  }

  const onchain = marketConfigured() && market.chainMarketId != null;
  const cid = market.chainMarketId as number;

  if (action === "close") {
    if (market.status !== "open") return NextResponse.json({ error: "not_open" }, { status: 409 });
    let resolveTxHash: string | undefined;
    if (onchain) {
      try { resolveTxHash = (await closeMarketOnchain({ marketId: cid })).txHash; }
      catch (e) { console.error("[markets/resolve] close on-chain failed:", e); return NextResponse.json({ error: "onchain_failed" }, { status: 502 }); }
    }
    const m = await db.predictionMarket.update({ where: { id }, data: { status: "closed", resolveTxHash } });
    return NextResponse.json(m);
  }

  if (action === "cancel") {
    if (market.status === "resolved") return NextResponse.json({ error: "already_resolved" }, { status: 409 });
    if (market.status === "cancelled") return NextResponse.json({ ok: true });
    const locked = await db.predictionMarket.updateMany({
      where: { id, status: market.status },
      data: { status: "cancelling" },
    });
    if (locked.count !== 1) return NextResponse.json({ error: "market_changed" }, { status: 409 });

    let resolveTxHash: string | undefined;
    if (onchain) {
      try { resolveTxHash = (await cancelMarketOnchain({ marketId: cid })).txHash; }
      catch (e) {
        console.error("[markets/resolve] cancel on-chain failed:", e);
        await db.predictionMarket.updateMany({ where: { id, status: "cancelling" }, data: { status: market.status } }).catch(() => {});
        return NextResponse.json({ error: "onchain_failed" }, { status: 502 });
      }
    }
    await db.$transaction([
      db.predictionMarket.update({ where: { id }, data: { status: "cancelled", resolveTxHash } }),
      db.prediction.updateMany({ where: { marketId: id }, data: { status: onchain ? "lost" : "claimed" } }),
    ]);
    return NextResponse.json({ ok: true, resolveTxHash, mockRefunded: !onchain });
  }

  if (action === "resolve") {
    const winningOption = Number(b?.winningOption);
    if (!["open", "closed"].includes(market.status)) return NextResponse.json({ error: "not_resolvable" }, { status: 409 });
    if (!Number.isInteger(winningOption) || winningOption < 0 || winningOption >= parseOptions(market.optionsJson).length) {
      return NextResponse.json({ error: "invalid_option" }, { status: 400 });
    }
    const winnersExist = market.predictions.some((p) => p.option === winningOption);
    if (!winnersExist) return NextResponse.json({ error: "no_winning_stake" }, { status: 409 });

    let resolveTxHash: string | undefined;
    if (onchain) {
      try { resolveTxHash = (await resolveMarketOnchain({ marketId: cid, winningOption })).txHash; }
      catch (e) { console.error("[markets/resolve] resolve on-chain failed:", e); return NextResponse.json({ error: "onchain_failed" }, { status: 502 }); }
    }

    await db.$transaction([
      db.predictionMarket.update({ where: { id }, data: { status: "resolved", winningOption, resolveTxHash } }),
      db.prediction.updateMany({ where: { marketId: id, option: winningOption }, data: { status: "won" } }),
      db.prediction.updateMany({ where: { marketId: id, option: { not: winningOption } }, data: { status: "lost" } }),
    ]);
    return NextResponse.json({ ok: true, resolveTxHash });
  }

  return NextResponse.json({ error: "invalid_action" }, { status: 400 });
}
