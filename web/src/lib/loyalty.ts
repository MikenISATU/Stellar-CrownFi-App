import { db } from "@/lib/db";

export const VOTE_POINTS = 5;
export const COLLECTIBLE_POINTS = 10;
export const PREDICT_POINTS = 5;
export const TICKET_POINTS = 10;

// Credit or debit a fan's points and write a ledger row atomically. Use a negative
// delta to spend. Balance and ledger never drift because both move in one transaction.
export async function recordPoints(fanId: string, delta: number, reason: string) {
  await db.$transaction([
    db.fan.update({ where: { id: fanId }, data: { points: { increment: delta } } }),
    db.loyaltyTransaction.create({ data: { fanId, delta, reason } }),
  ]);
}

// Best-effort points award that never blocks the primary action (voting/minting still
// succeeds even if the loyalty write fails, e.g. a mock fan not in the DB).
export async function tryAwardPoints(fanId: string, delta: number, reason: string) {
  try {
    await recordPoints(fanId, delta, reason);
  } catch (e) {
    console.warn(`[loyalty] could not award ${delta} to ${fanId} (${reason})`, e);
  }
}
