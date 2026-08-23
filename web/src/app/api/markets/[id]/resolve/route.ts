import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/adminAuth";
import { parseOptions } from "@/lib/markets";
import { marketConfigured, resolveMarketOnchain, closeMarketOnchain, cancelMarketOnchain } from "@/lib/stellar";

// POST — admin: close / resolve / cancel a market.
// body: { action: "close" | "resolve" | "cancel", winningOption?: number }
// Live mode mirrors each action onto the deployed contract (platform-signed) before the DB write.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = requireAdmin(req);
  if (admin instanceof NextResponse) return admin;

  const { id } = await ctx.params;
  const b = await req.json().catch(() => null);
  const action = String(b?.action ?? "");

  const market = await db.predictionMarket.findUnique({ where: { id }, include: { predictions: true } });
  if (!market) return NextResponse.json({ error: "not_found" }, { status: 404 });

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
    let resolveTxHash: string | undefined;
    if (onchain) {
      try { resolveTxHash = (await cancelMarketOnchain({ marketId: cid })).txHash; }
      catch (e) { console.error("[markets/resolve] cancel on-chain failed:", e); return NextResponse.json({ error: "onchain_failed" }, { status: 502 }); }
    }
    await db.$transaction([
      db.predictionMarket.update({ where: { id }, data: { status: "cancelled", resolveTxHash } }),
      db.prediction.updateMany({ where: { marketId: id }, data: { status: "lost" } }), // refundable state
    ]);
    return NextResponse.json({ ok: true });
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
