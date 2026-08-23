import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Loyalty shop catalog: active rewards with remaining stock.
export async function GET() {
  try {
    const rewards = await db.reward.findMany({
      where: { active: true },
      orderBy: { order: "asc" },
      include: { _count: { select: { redemptions: true } } },
    });
    return NextResponse.json(
      rewards.map((r) => ({
        key: r.key,
        title: r.title,
        description: r.description,
        cost: r.cost,
        icon: r.icon,
        stock: r.stock,
        remaining: r.stock == null ? null : Math.max(0, r.stock - r._count.redemptions),
      })),
    );
  } catch {
    return NextResponse.json([]);
  }
}
