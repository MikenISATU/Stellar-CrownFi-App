import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireFan } from "@/lib/fanAuth";
import { submitSignedXdr } from "@/lib/stellar";
import { consumeTxIntent } from "@/lib/txIntents";

// STEP 2 of cancelling a position: submit the fan's signed unstake tx, then remove their
// active position rows for that option (the USDC has been refunded on-chain).
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = requireFan(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await ctx.params;
  const b = await req.json().catch(() => null);
  const signedXdr = String(b?.signedXdr ?? "");
  const intentId = String(b?.intentId ?? "");
  if (!signedXdr || !intentId) return NextResponse.json({ error: "missing_fields" }, { status: 400 });

  const intent = consumeTxIntent(intentId);
  if (!intent || intent.kind !== "market-unstake" || intent.fanId !== auth.fanId || intent.marketId !== id) {
    return NextResponse.json({ error: "invalid_or_expired_intent" }, { status: 409 });
  }

  try {
    const submit = await submitSignedXdr(signedXdr, { source: auth.address, txHash: intent.txHash });
    await db.prediction.deleteMany({ where: { marketId: id, fanId: auth.fanId, option: intent.option, status: "active" } });
    return NextResponse.json({ ok: true, txHash: submit.txHash });
  } catch (e: any) {
    console.error("[api/markets/confirm-unstake] failed:", e);
    return NextResponse.json({ error: e?.message ?? "confirm_failed" }, { status: 500 });
  }
}
