import { db } from "@/lib/db";
import { readJson } from "@/lib/http";
import { cached } from "@/lib/serverCache";

// Aggregate counts across five tables — the most expensive read in the app, hit on every
// home visit. Nothing here needs to be fresher than a few seconds.
export async function GET() {
  return readJson(() => cached("stats", 15_000, async () => {
  const [votes, tickets, purchases, contestants, rounds, fans, predictions] = await Promise.all([
    db.vote.count(),
    db.ticket.count(),
    db.purchase.findMany({ select: { priceUsdc: true } }),
    db.contestant.findMany(),
    db.votingRound.count(),
    db.fan.count(),
    db.prediction.count(),
  ]);

  const ticketRows = await db.ticket.findMany({ select: { priceUsdc: true } });
  const gmv =
    purchases.reduce((s: number, p: { priceUsdc: number }) => s + p.priceUsdc, 0) +
    ticketRows.reduce((s: number, t: { priceUsdc: number }) => s + t.priceUsdc, 0);

  // Vote leaderboard.
  const grouped = await db.vote.groupBy({ by: ["contestantId"], _count: { contestantId: true } });
  const byId = new Map<string, { id: string; name: string; sash: string }>(
    contestants.map((c: { id: string; name: string; sash: string }) => [c.id, c])
  );
  const topContestants = grouped
    .map((g: { contestantId: string; _count: { contestantId: number } }) => ({
      name: byId.get(g.contestantId)?.name ?? "Unknown",
      sash: byId.get(g.contestantId)?.sash ?? "",
      votes: g._count.contestantId,
    }))
    .sort((a: { votes: number }, b: { votes: number }) => b.votes - a.votes)
    .slice(0, 8);

  return {
    votes,
    tickets,
    collectiblesSold: purchases.length,
    contestants: contestants.length,
    rounds,
    fans,
    predictions,
    gmv: Math.round(gmv),
    topContestants,
  };
  }));
}
