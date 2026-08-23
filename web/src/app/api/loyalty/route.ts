import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireFan } from "@/lib/fanAuth";

// Points balance + earn/spend history for the signed-in fan.
export async function GET(req: NextRequest) {
  const auth = requireFan(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const [fan, history, redemptions] = await Promise.all([
      db.fan.findUnique({ where: { id: auth.fanId }, select: { points: true } }),
      db.loyaltyTransaction.findMany({ where: { fanId: auth.fanId }, orderBy: { createdAt: "desc" }, take: 50 }),
      db.redemption.findMany({
        where: { fanId: auth.fanId },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { reward: { select: { title: true } } },
      }),
    ]);
    return NextResponse.json({
      points: fan?.points ?? 0,
      history: history.map((h) => ({ id: h.id, delta: h.delta, reason: h.reason, createdAt: h.createdAt })),
      redemptions: redemptions.map((r) => ({ id: r.id, title: r.reward.title, cost: r.cost, code: r.code, status: r.status, createdAt: r.createdAt })),
    });
  } catch {
    return NextResponse.json({ points: 0, history: [], redemptions: [] });
  }
}
