import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { readJson } from "@/lib/http";

type Row = { id: string; name: string; country: string; sash: string; portraitUrl: string | null; votes: number; rank: number };
type RoundLite = { id: string; title: string; status: string; category: string | null };

// Public, real-time leaderboard.
//
//   ?category=swimsuit|long_gown|qa   → every round in that category
//   ?category=overall                 → every round, combined into one board
//   ?roundId=…  / (no params)         → one round: the explicit id, else the open round, else the latest
//
// A CLOSED round contributes its anchored checkpoint tally (tamper-evident, matches what was
// sealed on Stellar); an open round contributes its live count. Every contestant is listed,
// including those on zero, so the board is always complete.
export async function GET(req: NextRequest) {
  const roundIdParam = req.nextUrl.searchParams.get("roundId");
  const categoryParam = req.nextUrl.searchParams.get("category");

  return readJson(async () => {
    const contestants = await db.contestant.findMany({
      select: { id: true, name: true, country: true, sash: true, portraitUrl: true },
    });

    // ── Scope: which rounds feed this board? ────────────────────────────
    let rounds: RoundLite[];
    let round: RoundLite | null = null;

    if (categoryParam === "overall") {
      rounds = await db.votingRound.findMany({ orderBy: { openedAt: "desc" } });
    } else if (categoryParam) {
      rounds = await db.votingRound.findMany({ where: { category: categoryParam }, orderBy: { openedAt: "desc" } });
      round = rounds.find((r) => r.status === "open") ?? rounds[0] ?? null;
    } else {
      round =
        (roundIdParam ? await db.votingRound.findUnique({ where: { id: roundIdParam } }) : null) ??
        (await db.votingRound.findFirst({ where: { status: "open" }, orderBy: { openedAt: "desc" } })) ??
        (await db.votingRound.findFirst({ orderBy: { openedAt: "desc" } }));
      rounds = round ? [round] : [];
    }

    // ── Tally: anchored where we can, live where we can't ───────────────
    const counts = new Map<string, number>();
    const add = (id: string, n: number) => counts.set(id, (counts.get(id) ?? 0) + n);

    const closedIds = rounds.filter((r) => r.status === "closed").map((r) => r.id);
    const checkpoints = closedIds.length
      ? await db.checkpoint.findMany({ where: { roundId: { in: closedIds } } })
      : [];

    const anchored = new Set<string>();
    for (const cp of checkpoints) {
      try {
        const tally = JSON.parse(cp.tallyJson) as { contestantId: string; votes: number }[];
        for (const t of tally) add(t.contestantId, t.votes);
        anchored.add(cp.roundId);
      } catch {
        /* unreadable tally — this round falls back to a live count below */
      }
    }

    const liveIds = rounds.filter((r) => !anchored.has(r.id)).map((r) => r.id);
    if (liveIds.length) {
      const grouped = await db.vote.groupBy({
        by: ["contestantId"],
        where: { roundId: { in: liveIds } },
        _count: { contestantId: true },
      });
      for (const g of grouped as { contestantId: string; _count: { contestantId: number } }[]) {
        add(g.contestantId, g._count.contestantId);
      }
    }

    const rows: Row[] = contestants
      .map((c) => ({ ...c, votes: counts.get(c.id) ?? 0, rank: 0 }))
      .sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name));
    rows.forEach((r, i) => (r.rank = i + 1));

    return {
      category: categoryParam ?? round?.category ?? null,
      roundId: round?.id ?? null,
      roundTitle: round?.title ?? null,
      status: round?.status ?? null,
      roundCount: rounds.length,
      openRounds: rounds.filter((r) => r.status === "open").length,
      // "Verified" only when every round on the board came from an anchored tally.
      verified: rounds.length > 0 && rounds.every((r) => anchored.has(r.id)),
      total: rows.reduce((s, r) => s + r.votes, 0),
      contestants: rows,
    };
  });
}
