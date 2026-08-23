import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { requireFan } from "@/lib/fanAuth";

const ERR_STATUS: Record<string, number> = {
  reward_not_found: 404,
  out_of_stock: 409,
  fan_not_found: 404,
  insufficient_points: 402,
};

// Redeem a reward: validates balance AND stock inside one transaction, deducts points,
// writes the ledger row, and issues a voucher code — all or nothing.
export async function POST(req: NextRequest) {
  const auth = requireFan(req);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  const rewardKey = String(body?.rewardKey ?? "").trim();
  if (!rewardKey) return NextResponse.json({ error: "missing_reward" }, { status: 400 });

  try {
    const result = await db.$transaction(async (tx) => {
      const reward = await tx.reward.findUnique({
        where: { key: rewardKey },
        include: { _count: { select: { redemptions: true } } },
      });
      if (!reward || !reward.active) throw new Error("reward_not_found");
      if (reward.stock != null && reward._count.redemptions >= reward.stock) throw new Error("out_of_stock");

      const fan = await tx.fan.findUnique({ where: { id: auth.fanId }, select: { points: true } });
      if (!fan) throw new Error("fan_not_found");
      if (fan.points < reward.cost) throw new Error("insufficient_points");

      const code = `CROWN-${randomBytes(4).toString("hex").toUpperCase()}`;
      const redemption = await tx.redemption.create({
        data: { fanId: auth.fanId, rewardId: reward.id, cost: reward.cost, code },
      });
      await tx.loyaltyTransaction.create({ data: { fanId: auth.fanId, delta: -reward.cost, reason: `redeem:${reward.key}` } });
      const updated = await tx.fan.update({
        where: { id: auth.fanId },
        data: { points: { decrement: reward.cost } },
        select: { points: true },
      });

      return { code: redemption.code, title: reward.title, points: updated.points };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    const key = String(e?.message ?? "redeem_failed");
    return NextResponse.json({ error: key }, { status: ERR_STATUS[key] ?? 500 });
  }
}
