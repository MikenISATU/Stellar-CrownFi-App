import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readFanSession } from "@/lib/fanAuth";
import { computeMarketView } from "@/lib/markets";

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
    const mine = fan ? m.predictions.filter((p) => p.fanId === fan.fanId).map((p) => ({ option: p.option, amount: p.amount, status: p.status })) : [];

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

    return NextResponse.json({ ...view, activity, mine, series });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
