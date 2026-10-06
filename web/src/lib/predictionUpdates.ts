export const RANKING_SIZES = [20, 10, 5, 3] as const;

export function validRanking(size: number, options: unknown, count: number): options is number[] {
  return RANKING_SIZES.includes(size as 20) && Array.isArray(options) && options.length === size
    && new Set(options).size === size
    && options.every((index) => Number.isInteger(index) && index >= 0 && index < count);
}

export function validPublicPath(path: unknown): path is string {
  return typeof path === "string" && path.length <= 160
    && /^(\/(?:vote|predictions|leaderboard|winners|verify|tickets|contestants|loyalty|organize|faq|security|seatmap)(?:\/[a-zA-Z0-9_-]+)*|\/)$/.test(path);
}

export type SavedRanking = { size: number; options: number[]; labels: string[] };

// Device-only UI preferences, never a contract position or an account-level record.
export function readDeviceRankings(raw: string | null, labels: string[]): SavedRanking[] {
  if (!raw) return [];
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value)) throw new Error("invalid_saved_rankings");
  return value.filter((r): r is SavedRanking => Boolean(r && typeof r === "object"
    && validRanking(r.size, r.options, labels.length)
    && Array.isArray(r.labels) && r.labels.length === r.size
    && r.options.every((index: number, i: number) => labels[index] === r.labels[i])));
}
