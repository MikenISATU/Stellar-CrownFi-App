// Prediction-market view helpers: turn a market + its predictions into pools, odds,
// participants, and a normalized status the UI can render.

// Platform fee, in basis points. Charged ONLY on winnings at claim time (the on-chain
// contract does `fee = gross_payout * fee_bps / 10000`, never on the stake itself).
// Keep this in sync with the contract's initialize(fee_bps=...).
export const PLATFORM_FEE_BPS = Number(process.env.NEXT_PUBLIC_PLATFORM_FEE_BPS ?? "200"); // 2%
export const PLATFORM_FEE_PCT = PLATFORM_FEE_BPS / 100; // for display, e.g. 2

export type MarketOptionView = { index: number; label: string; flagCode: string | null; pool: number; percent: number };
export type MarketView = {
  id: string;
  pageantId: string | null;
  category: string;
  question: string;
  status: string; // open | closed | resolved | cancelled
  live: boolean; // open AND before close time
  official: boolean; // admin/platform-created (highlighted) vs community
  closeTime: string;
  endsInMs: number;
  winningOption: number | null;
  bannerUrl: string | null;
  options: MarketOptionView[];
  totalPool: number;
  participants: number;
};

type MarketRow = {
  id: string;
  pageantId: string | null;
  creatorFanId?: string | null;
  category: string;
  question: string;
  optionsJson: string;
  optionFlagsJson?: string | null;
  status: string;
  closeTime: Date;
  winningOption: number | null;
  bannerUrl: string | null;
};

export function parseOptions(optionsJson: string): string[] {
  try {
    const a = JSON.parse(optionsJson);
    return Array.isArray(a) ? a.map((x) => String(x)) : [];
  } catch {
    return [];
  }
}

export function parseOptionFlags(optionFlagsJson?: string | null): (string | null)[] {
  try {
    const values = optionFlagsJson ? JSON.parse(optionFlagsJson) : [];
    return Array.isArray(values)
      ? values.map((value) => {
          const code = String(value ?? "").trim().toUpperCase();
          return /^[A-Z]{2}$/.test(code) ? code : null;
        })
      : [];
  } catch {
    return [];
  }
}

export function computeMarketView(
  m: MarketRow,
  predictions: { option: number; amount: number; fanId: string }[],
): MarketView {
  const labels = parseOptions(m.optionsJson);
  const flags = parseOptionFlags(m.optionFlagsJson);
  const pools = labels.map(() => 0);
  const fans = new Set<string>();
  let total = 0;
  for (const p of predictions) {
    if (p.option >= 0 && p.option < pools.length) pools[p.option] += p.amount;
    total += p.amount;
    fans.add(p.fanId);
  }
  const options: MarketOptionView[] = labels.map((label, index) => ({
    index,
    label,
    flagCode: flags[index] ?? null,
    pool: Math.round(pools[index] * 100) / 100,
    percent: total > 0 ? Math.round((pools[index] / total) * 1000) / 10 : 0,
  }));
  const now = Date.now();
  const endsInMs = m.closeTime.getTime() - now;
  return {
    id: m.id,
    pageantId: m.pageantId,
    category: m.category,
    question: m.question,
    status: m.status,
    live: m.status === "open" && endsInMs > 0,
    official: !m.creatorFanId,
    closeTime: m.closeTime.toISOString(),
    endsInMs,
    winningOption: m.winningOption,
    bannerUrl: m.bannerUrl,
    options,
    totalPool: Math.round(total * 100) / 100,
    participants: fans.size,
  };
}

// Estimated NET payout for a stake of `amount` on `option`, given current pools (pro-rata).
// The fee applies to WINNINGS only (gross minus your stake back), matching the contract —
// a sole winner pays no fee and simply gets their stake back.
export function estimateReward(view: { options: { pool: number }[]; totalPool: number }, option: number, amount: number, feeBps = PLATFORM_FEE_BPS): number {
  const opt = view.options[option];
  if (!opt || amount <= 0) return 0;
  const newTotal = view.totalPool + amount;
  const newOptionPool = opt.pool + amount;
  const gross = (amount * newTotal) / newOptionPool;
  const profit = Math.max(0, gross - amount);
  const net = amount + profit * (1 - feeBps / 10000);
  return Math.round(net * 100) / 100;
}
