import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireFan } from "@/lib/fanAuth";
import { submitSignedXdr } from "@/lib/stellar";
import { consumeTxIntent } from "@/lib/txIntents";

// STEP 2 of a payout: submit the winner's signed claim tx and mark their positions claimed.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = requireFan(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await ctx.params;
  const b = await req.json().catch(() => null);
  const signedXdr = String(b?.signedXdr ?? "");
  const intentId = String(b?.intentId ?? "");
  if (!signedXdr || !intentId) return NextResponse.json({ error: "missing_fields" }, { status: 400 });

  const intent = consumeTxIntent(intentId);
  if (!intent || intent.kind !== "market-claim" || intent.fanId !== auth.fanId || intent.marketId !== id) {
    return NextResponse.json({ error: "invalid_or_expired_intent" }, { status: 409 });
  }

  try {
    const submit = await submitSignedXdr(signedXdr, { source: auth.address, txHash: intent.txHash });
    await db.prediction.updateMany({
      where: { marketId: id, fanId: auth.fanId, status: "won" },
      data: { status: "claimed", claimTxHash: submit.txHash },
    });
    return NextResponse.json({ ok: true, txHash: submit.txHash });
  } catch (e: any) {
    console.error("[api/markets/confirm-claim] failed:", e);
    return NextResponse.json({ error: e?.message ?? "confirm_failed" }, { status: 500 });
  }
}
