import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { PAGEANT_SEGMENTS, CATEGORY_LABEL } from "@/lib/segments";

// Public winners feed for the coronation page. Gated SERVER-side by the admin's
// "Announce winners" switch — before the flip, the response carries no results at all,
// so an early peek at the API reveals nothing. Winners come exclusively from anchored
// checkpoint tallies (sealed at close), never from live counts.
//
// Reads settings straight from the DB (not the cached getSettings) so the admin's flip
// is visible to fans immediately, on every server instance.
export async function GET() {
  try {
    const settings = await db.platformSettings.findUnique({ where: { id: "singleton" } });
    if (!settings?.winnersAnnounced) {
      return NextResponse.json({ announced: false, winners: [] });
    }

    const contestants = await db.contestant.findMany({
      select: { id: true, name: true, country: true, sash: true, portraitUrl: true },
    });
    const byId = new Map(contestants.map((c) => [c.id, c]));

    const winners: any[] = [];
    for (const seg of PAGEANT_SEGMENTS) {
      // Latest closed round in this stage that actually has an anchored checkpoint.
      const round = await db.votingRound.findFirst({
        where: { category: seg.key, status: "closed", checkpoint: { isNot: null } },
        orderBy: { openedAt: "desc" },
        include: { checkpoint: true },
      });
      if (!round?.checkpoint) continue;

      let tally: { contestantId: string; name?: string; votes: number }[] = [];
      try { tally = JSON.parse(round.checkpoint.tallyJson); } catch { continue; }
      if (!tally.length) continue;
      tally.sort((a, b) => b.votes - a.votes);
      const top = tally[0];
      const c = byId.get(top.contestantId);

      winners.push({
        category: seg.key,
        label: CATEGORY_LABEL[seg.key] ?? seg.key,
        roundTitle: round.title,
        name: top.name ?? c?.name ?? "Unknown",
        country: c?.country ?? "",
        sash: c?.sash ?? "",
        contestantId: top.contestantId,
        portraitUrl: c?.portraitUrl ?? null,
        votes: top.votes,
        totalVotes: round.checkpoint.totalVotes,
        anchorTx: round.checkpoint.anchorTx,
        merkleRoot: round.checkpoint.merkleRoot,
      });
    }

    return NextResponse.json({ announced: true, winners });
  } catch (e) {
    console.error("[api/winners] failed:", e);
    return NextResponse.json({ announced: false, winners: [] });
  }
}
