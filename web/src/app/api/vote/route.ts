import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { voteLeaf } from "@/lib/merkle";
import { rateLimit } from "@/lib/ratelimit";
import { clientIp } from "@/lib/ip";
import { requireFan } from "@/lib/fanAuth";
import { tryAwardPoints, VOTE_POINTS } from "@/lib/loyalty";

// GET — the signed-in wallet's own votes, so the Vote tab can show what it already picked
// instead of offering a choice the server will reject. Session-derived: a wallet can only ever
// read its own ballot.
export async function GET(req: NextRequest) {
  const auth = requireFan(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const votes = await db.vote.findMany({
      where: { fanId: auth.fanId },
      select: { roundId: true, contestantId: true, createdAt: true },
    });
    return NextResponse.json({ votes });
  } catch {
    return NextResponse.json({ votes: [] });
  }
}

// Off-chain vote intake. Fast path: rate limit, quota check, then a single insert whose
// unique constraint (roundId, fanId) is the real duplicate-vote guard.
// fanId is derived from the verified wallet session — never trusted from the body — so
// votes cannot be cast on behalf of, or as fabricated, fans.
export async function POST(req: NextRequest) {
  const auth = requireFan(req);
  if (auth instanceof NextResponse) return auth;
  const fanId = auth.fanId;

  const ip = clientIp(req);
  const rl = rateLimit(`vote:${ip}`);
  if (!rl.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  let body: { roundId?: string; contestantId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const { roundId, contestantId } = body;
  if (!roundId || !contestantId)
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });

  const round = await db.votingRound.findUnique({ where: { id: roundId } });
  if (!round) return NextResponse.json({ error: "round_not_found" }, { status: 404 });
  if (round.status !== "open")
    return NextResponse.json({ error: "round_closed" }, { status: 409 });

  const quota = Number(process.env.VOTE_QUOTA_PER_ROUND ?? "1");
  const existing = await db.vote.count({ where: { roundId, fanId } });
  if (existing >= quota)
    return NextResponse.json({ error: "quota_reached" }, { status: 409 });

  try {
    const vote = await db.vote.create({
      data: { roundId, fanId, contestantId, leafHash: voteLeaf(fanId, contestantId, roundId) },
    });
    // Loyalty: voting earns points (best-effort — never blocks the vote).
    await tryAwardPoints(fanId, VOTE_POINTS, "vote");
    return NextResponse.json({ ok: true, voteId: vote.id, pointsAwarded: VOTE_POINTS });
  } catch (e: unknown) {
    // Unique constraint => duplicate vote.
    return NextResponse.json({ error: "duplicate_vote" }, { status: 409 });
  }
}
