import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readJson } from "@/lib/http";
import { requireFan } from "@/lib/fanAuth";
import { parseOptions } from "@/lib/markets";

// Personal dashboard — fanId comes from the verified session, so a fan can only
// ever read their own votes/tickets/purchases (closes the ?fanId IDOR).
export async function GET(req: NextRequest) {
  const auth = requireFan(req);
  if (auth instanceof NextResponse) return auth;
  const fanId = auth.fanId;

  return readJson(async () => {
  const [votes, tickets, purchases, predictions] = await Promise.all([
    db.vote.findMany({
      where: { fanId },
      orderBy: { createdAt: "desc" },
      include: { contestant: true, round: true },
    }),
    db.ticket.findMany({ where: { fanId }, orderBy: { createdAt: "desc" } }),
    db.purchase.findMany({
      where: { fanId },
      orderBy: { createdAt: "desc" },
      include: { collectible: true },
    }),
    db.prediction.findMany({
      where: { fanId },
      orderBy: { createdAt: "desc" },
      include: { market: true },
    }),
  ]);

  const preds = predictions.map((p: any) => {
    const label = parseOptions(p.market.optionsJson)[p.option] ?? `Option ${p.option}`;
    return { marketId: p.marketId, question: p.market.question, option: label, amount: p.amount, status: p.status, marketStatus: p.market.status };
  });

  return {
    votes: votes.map((v: any) => ({ contestant: v.contestant.name, round: v.round.title, status: v.round.status })),
    tickets: tickets.map((t: any) => ({ tier: t.tier, seat: t.seat, eventName: t.eventName, tokenId: t.tokenId })),
    collectibles: purchases.map((p: any) => ({ title: p.collectible.title, priceUsdc: p.priceUsdc, tokenId: p.tokenId, mintTx: p.mintTx, imageUrl: p.collectible.imageUrl ?? null, candidateId: p.collectible.candidateId ?? null })),
    predictions: preds,
    activePredictions: preds.filter((p) => p.status === "active").length,
    totalStaked: preds.reduce((s, p) => s + p.amount, 0),
  };
  });
}
