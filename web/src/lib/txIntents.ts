import { signToken, verifyToken } from "@/lib/statelessToken";

const INTENT_TTL_MS = 10 * 60 * 1000;

type BaseIntent = {
  id: string;
  kind: "ticket-buy" | "collectible-buy" | "round-close" | "market-stake" | "market-claim" | "market-unstake";
  txHash: string;
  expectedSource: string;
  expiresAt: number;
};

type TicketIntent = BaseIntent & { kind: "ticket-buy"; fanId: string; tier: string; listingId: number };
type CollectibleIntent = BaseIntent & { kind: "collectible-buy"; fanId: string; collectibleId: string; listingId: number };
type RoundCloseIntent = BaseIntent & { kind: "round-close"; roundId: string };
type MarketStakeIntent = BaseIntent & { kind: "market-stake"; fanId: string; marketId: string; option: number; amountUsdc: number };
type MarketClaimIntent = BaseIntent & { kind: "market-claim"; fanId: string; marketId: string };
type MarketUnstakeIntent = BaseIntent & { kind: "market-unstake"; fanId: string; marketId: string; option: number };

export type TxIntent = TicketIntent | CollectibleIntent | RoundCloseIntent | MarketStakeIntent | MarketClaimIntent | MarketUnstakeIntent;
type NewTxIntent =
  | Omit<TicketIntent, "id" | "expiresAt">
  | Omit<CollectibleIntent, "id" | "expiresAt">
  | Omit<RoundCloseIntent, "id" | "expiresAt">
  | Omit<MarketStakeIntent, "id" | "expiresAt">
  | Omit<MarketClaimIntent, "id" | "expiresAt">
  | Omit<MarketUnstakeIntent, "id" | "expiresAt">;

const intents = new Map<string, TxIntent>();

// The intent id IS the intent: an HMAC-signed token carrying the full payload, so the
// confirm route can verify it on ANY server instance (the Map alone broke on serverless —
// prepare and confirm can land on different instances that share no memory). The Map stays
// as a same-instance replay guard; across instances, replaying a consumed intent just
// re-submits the same signed transaction, which the chain rejects (sequence already used).
export function createTxIntent(intent: NewTxIntent): TxIntent {
  const payload = { ...intent, expiresAt: Date.now() + INTENT_TTL_MS };
  const id = signToken(payload);
  const stored = { ...payload, id } as TxIntent;
  intents.set(id, stored);
  return stored;
}

const consumed = new Set<string>();

export function consumeTxIntent(id: string): TxIntent | null {
  // Same-instance fast path (strict one-time use).
  const local = intents.get(id);
  intents.delete(id);
  if (local) {
    if (Date.now() > local.expiresAt) return null;
    consumed.add(id);
    return local;
  }
  // Cross-instance path: the token authenticates itself.
  if (consumed.has(id)) return null; // same-instance replay of an already-used intent
  const payload = verifyToken<Omit<TxIntent, "id">>(id);
  if (!payload) return null;
  if (Date.now() > payload.expiresAt) return null;
  consumed.add(id);
  return { ...payload, id } as TxIntent;
}
