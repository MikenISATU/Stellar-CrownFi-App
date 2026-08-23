import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getWallet } from "@/wallet";
import { buyCollectible } from "@/lib/stellar";
import { requireFan } from "@/lib/fanAuth";
import { tryAwardPoints, COLLECTIBLE_POINTS } from "@/lib/loyalty";
import { ROSTER } from "@/lib/roster";
import { cached } from "@/lib/serverCache";

const LIVE = (process.env.STELLAR_MODE ?? "mock") === "live";

// Roster shaped like a Collectible (+ contestant), for the no-database fallback.
const ROSTER_AS_COLLECTIBLES = ROSTER.map((r) => ({
  id: `${r.id}-collectible`,
  title: `${r.name} — Official Portrait`,
  metadataUri: `ipfs://demo/${r.id}.json`,
  priceUsdc: r.priceUsdc,
  edition: 1,
  tokenId: null as string | null,
  contestant: { id: r.id, name: r.name, country: r.country, sash: r.sash, portraitUrl: r.photo },
}));

export async function GET() {
  try {
    // Collectible rows only change when an admin adds a contestant (which invalidates this).
    const rows = await cached("collectibles", 30_000, () =>
      db.collectible.findMany({ orderBy: { createdAt: "desc" }, include: { contestant: true } })
    );
    return NextResponse.json(rows.length ? rows : ROSTER_AS_COLLECTIBLES);
  } catch {
    console.warn("[api/collectibles] database unavailable — serving static roster.");
    return NextResponse.json(ROSTER_AS_COLLECTIBLES);
  }
}

// Buy a collectible: resolve wallet, mint (mock or live via the sale-splitter), record the purchase,
// and reward loyalty points. In live mode the payment split happens on-chain.
export async function POST(req: NextRequest) {
  if (LIVE) return NextResponse.json({ error: "use_prepare_confirm_flow" }, { status: 409 });

  const auth = requireFan(req);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  if (!body?.collectibleId)
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });

  const fan = await db.fan.findUnique({ where: { id: auth.fanId } });
  const collectible = await db.collectible.findUnique({ where: { id: body.collectibleId } });
  if (!fan || !collectible) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // One collectible per fan — blocks the +10-points-per-rebuy farm.
  const owned = await db.purchase.findFirst({ where: { fanId: fan.id, collectibleId: collectible.id } });
  if (owned) return NextResponse.json({ error: "already_owned" }, { status: 409 });

  const address = fan.walletAddress ?? (await getWallet().ensureAddress(fan.handle));
  if (!fan.walletAddress) await db.fan.update({ where: { id: fan.id }, data: { walletAddress: address } });

  const buy = await buyCollectible({ toAddress: address, metadataUri: collectible.metadataUri });

  const purchase = await db.purchase.create({
    data: { fanId: fan.id, collectibleId: collectible.id, priceUsdc: collectible.priceUsdc, tokenId: buy.tokenId, mintTx: buy.txHash },
  });
  await tryAwardPoints(fan.id, COLLECTIBLE_POINTS, "collectible");

  return NextResponse.json({ ok: true, purchase, buyMode: buy.mode });
}
