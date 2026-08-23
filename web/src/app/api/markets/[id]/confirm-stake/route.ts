import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireFan } from "@/lib/fanAuth";
import { submitSignedXdr } from "@/lib/stellar";
import { consumeTxIntent } from "@/lib/txIntents";
import { tryAwardPoints, PREDICT_POINTS } from "@/lib/loyalty";

// STEP 2 of an on-chain prediction: submit the fan's signed stake tx, then record the prediction
// and award loyalty points. The intent (matched by txHash) prevents tampering / replay.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = requireFan(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await ctx.params;
  const b = await req.json().catch(() => null);
  const signedXdr = String(b?.signedXdr ?? "");
  const intentId = String(b?.intentId ?? "");
  if (!signedXdr || !intentId) return NextResponse.json({ error: "missing_fields" }, { status: 400 });

  const market = await db.predictionMarket.findUnique({ where: { id } });
  if (!market) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const intent = consumeTxIntent(intentId);
  if (!intent || intent.kind !== "market-stake" || intent.fanId !== auth.fanId || intent.marketId !== id) {
    return NextResponse.json({ error: "invalid_or_expired_intent" }, { status: 409 });
  }

  try {
    const submit = await submitSignedXdr(signedXdr, { source: auth.address, txHash: intent.txHash });
    const prediction = await db.prediction.create({
      data: { marketId: id, fanId: auth.fanId, option: intent.option, amount: intent.amountUsdc, txHash: submit.txHash },
    });
    await tryAwardPoints(auth.fanId, PREDICT_POINTS, "predict");
    return NextResponse.json({ ok: true, prediction, txHash: submit.txHash, pointsAwarded: PREDICT_POINTS });
  } catch (e: any) {
    console.error("[api/markets/confirm-stake] failed:", e);
    return NextResponse.json({ error: e?.message ?? "confirm_failed" }, { status: 500 });
  }
}
