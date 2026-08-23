import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rosterById, rosterMeta } from "@/lib/roster";
import { readFanSession } from "@/lib/fanAuth";

// No-database (or unseeded) fallback built from the static roster.
function rosterFallback(id: string) {
  const r = rosterById[id];
  if (!r) return null;
  return {
    contestant: { id: r.id, name: r.name, country: r.country, sash: r.sash, portraitUrl: r.photo, continent: r.continent, height: r.height, nftUrl: r.nft ?? null },
    stats: { votes: 0, rank: 0, totalContestants: 0, totalVotes: 0, roundId: null, roundTitle: null, status: null },
    collectibles: [{ id: `${r.id}-collectible`, title: `${r.name} — Official Portrait`, priceUsdc: r.priceUsdc, metadataUri: `ipfs://demo/${r.id}.json`, candidateId: null, edition: 1, listingId: null, minted: 0, perWallet: 1, ownedByMe: false }],
  };
}

// Per-candidate detail: profile, live vote stats + rank, and the collectible(s) to mint.
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const fan = readFanSession(req);

  try {
    const contestant = await db.contestant.findUnique({ where: { id } });
    if (!contestant) {
      const fb = rosterFallback(id);
      return fb ? NextResponse.json(fb) : NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const round =
      (await db.votingRound.findFirst({ where: { status: "open" }, orderBy: { openedAt: "desc" } })) ??
      (await db.votingRound.findFirst({ orderBy: { openedAt: "desc" } }));

    const where = round ? { roundId: round.id } : {};
    const grouped = await db.vote.groupBy({ by: ["contestantId"], where, _count: { contestantId: true } });
    const counts = new Map<string, number>();
    for (const g of grouped as { contestantId: string; _count: { contestantId: number } }[]) {
      counts.set(g.contestantId, g._count.contestantId);
    }
    const all = await db.contestant.findMany({ select: { id: true } });
    const ranked = all.map((c) => ({ id: c.id, votes: counts.get(c.id) ?? 0 })).sort((a, b) => b.votes - a.votes);
    const rank = ranked.findIndex((r) => r.id === id) + 1;
    const votes = counts.get(id) ?? 0;
    const totalVotes = ranked.reduce((s, r) => s + r.votes, 0);

    const collectibleRows = await db.collectible.findMany({
      where: { contestantId: id },
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { purchases: true } } },
    });
    // Which of these has the signed-in fan already minted? (one-per-wallet)
    const myOwned = fan
      ? new Set((await db.purchase.findMany({ where: { fanId: fan.fanId, collectibleId: { in: collectibleRows.map((c) => c.id) } }, select: { collectibleId: true } })).map((p) => p.collectibleId))
      : new Set<string>();
    const collectibles = collectibleRows.map((c) => ({
      id: c.id, title: c.title, priceUsdc: c.priceUsdc, metadataUri: c.metadataUri,
      candidateId: c.candidateId, edition: c.edition, listingId: c.listingId,
      minted: c._count.purchases, // how many fans have collected it (unlimited supply, 1 per wallet)
      perWallet: 1,
      ownedByMe: myOwned.has(c.id),
    }));

    const meta = rosterMeta(contestant.sash);
    return NextResponse.json({
      contestant: {
        id: contestant.id,
        name: contestant.name,
        country: contestant.country,
        sash: contestant.sash,
        portraitUrl: contestant.portraitUrl ?? meta.photo ?? null,
        continent: meta.continent,
        height: meta.height,
        nftUrl: meta.nft ?? null,
      },
      stats: { votes, rank, totalContestants: all.length, totalVotes, roundId: round?.id ?? null, roundTitle: round?.title ?? null, status: round?.status ?? null },
      collectibles,
    });
  } catch {
    const fb = rosterFallback(id);
    return fb ? NextResponse.json(fb) : NextResponse.json({ error: "not_found" }, { status: 404 });
  }
}
