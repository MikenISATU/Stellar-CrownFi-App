import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readAdminSession } from "@/lib/adminAuth";
import { readFanSession } from "@/lib/fanAuth";
import { computeMarketView } from "@/lib/markets";
import { rateLimit } from "@/lib/ratelimit";
import { clientIp } from "@/lib/ip";
import { marketConfigured, createMarketOnchain } from "@/lib/stellar";

// Community markets per user (open at once). Admins are unlimited.
const MAX_USER_MARKETS = Number(process.env.MAX_USER_MARKETS ?? "3");

// GET — public list of markets (filters: ?category= ?status= ?pageantId= ?q=).
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const where: any = {};
  if (sp.get("category")) where.category = sp.get("category");
  if (sp.get("status")) where.status = sp.get("status");
  if (sp.get("pageantId")) where.pageantId = sp.get("pageantId");
  const q = sp.get("q")?.trim();
  if (q) where.question = { contains: q, mode: "insensitive" };

  try {
    const rows = await db.predictionMarket.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { predictions: { select: { option: true, amount: true, fanId: true } } },
    });
    return NextResponse.json(rows.map((m) => computeMarketView(m, m.predictions)));
  } catch {
    return NextResponse.json([]);
  }
}

// POST — create a market. Admin → official (unlimited). Signed-in fan → community (limited).
export async function POST(req: NextRequest) {
  const admin = readAdminSession(req);
  const fan = admin ? null : readFanSession(req);
  if (!admin && !fan) return NextResponse.json({ error: "fan_auth_required" }, { status: 401 });

  if (fan) {
    const rl = rateLimit(`market:${clientIp(req)}`, 5, 60_000);
    if (!rl.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const b = await req.json().catch(() => null);
  const question = String(b?.question ?? "").trim().slice(0, 300);
  const category = String(b?.category ?? "").trim().slice(0, 40);
  const options: string[] = Array.isArray(b?.options) ? b.options.map((x: any) => String(x).trim().slice(0, 120)).filter(Boolean) : [];
  const optionFlags: (string | null)[] = Array.isArray(b?.optionFlags)
    ? b.optionFlags.slice(0, options.length).map((x: any) => {
        const code = String(x ?? "").trim().toUpperCase();
        return /^[A-Z]{2}$/.test(code) ? code : null;
      })
    : [];
  const closeTime = b?.closeTime ? new Date(b.closeTime) : null;

  if (!question || !category) return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  if (options.length < 2 || options.length > 32) return NextResponse.json({ error: "invalid_options" }, { status: 400 });
  if (!closeTime || isNaN(closeTime.getTime()) || closeTime.getTime() <= Date.now()) return NextResponse.json({ error: "invalid_close_time" }, { status: 400 });

  try {
    // Per-user cap on open community markets.
    if (fan) {
      const open = await db.predictionMarket.count({ where: { creatorFanId: fan.fanId, status: "open" } });
      if (open >= MAX_USER_MARKETS) return NextResponse.json({ error: "market_limit_reached" }, { status: 429 });
    }

    let market = await db.predictionMarket.create({
      data: {
        question,
        category,
        optionsJson: JSON.stringify(options),
        optionFlagsJson: optionFlags.some(Boolean) ? JSON.stringify(options.map((_, i) => optionFlags[i] ?? null)) : null,
        closeTime,
        creatorFanId: fan ? fan.fanId : null, // null = official
        pageantId: b?.pageantId ? String(b.pageantId) : null,
        bannerUrl: b?.bannerUrl ? String(b.bannerUrl).slice(0, 400) : null,
      },
    });

    // Live mode: create the escrow market on-chain and record its id. If that fails, roll back
    // the DB row so we never show a market that can't accept real stakes.
    if (marketConfigured()) {
      try {
        const { marketId, txHash } = await createMarketOnchain({
          question,
          category,
          numOptions: options.length,
          closeUnix: Math.floor(closeTime.getTime() / 1000),
        });
        market = await db.predictionMarket.update({
          where: { id: market.id },
          data: { chainMarketId: marketId, createTxHash: txHash },
        });
      } catch (e) {
        console.error("[api/markets] on-chain create failed:", e);
        await db.predictionMarket.delete({ where: { id: market.id } }).catch(() => {});
        return NextResponse.json({ error: "onchain_create_failed" }, { status: 502 });
      }
    }
    return NextResponse.json(market);
  } catch (e) {
    console.error("[api/markets] create failed:", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
