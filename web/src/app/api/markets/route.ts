import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readAdminSession } from "@/lib/adminAuth";
import { readFanSession } from "@/lib/fanAuth";
import { computeMarketView, parseMarketInput } from "@/lib/markets";
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
    const admin = readAdminSession(req);
    const fan = readFanSession(req);
    const rows = await db.predictionMarket.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { predictions: { select: { option: true, amount: true, fanId: true } } },
    });
    return NextResponse.json(rows.map((m) => {
      const isCreator = Boolean(fan && m.creatorFanId === fan.fanId);
      const canManage = Boolean(admin || isCreator);
      const hasPositions = m.predictions.length > 0;
      return { ...computeMarketView(m, m.predictions), isCreator, canManage, canEdit: canManage && m.status === "open" && !hasPositions, hasPositions };
    }));
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
  const parsed = parseMarketInput(b);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { question, category, options, optionFlags, closeTime, pageantId, bannerUrl } = parsed.value;

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
        pageantId,
        bannerUrl,
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
