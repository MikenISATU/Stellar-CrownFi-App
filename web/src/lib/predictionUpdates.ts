export const RANKING_SIZES = [20, 10, 5, 3] as const;
export const SUGGESTED_MARKET_TAGS = ["Male", "Female", "LGBTQIA+", "Kids", "Local", "International", "Moms"];

export function validRanking(size: number, options: unknown, count: number): options is number[] {
  return RANKING_SIZES.includes(size as 20) && Array.isArray(options) && options.length === size
    && new Set(options).size === size
    && options.every((index) => Number.isInteger(index) && index >= 0 && index < count);
}

export function parseMarketTags(value: unknown): string[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 8) return null;
  const tags: string[] = [];
  for (const raw of value) {
    if (typeof raw !== "string") return null;
    const tag = raw.trim().replace(/^#/, "");
    if (!tag || tag.length > 24 || !/^[\p{L}\p{N} +&-]+$/u.test(tag)) return null;
    if (!tags.some((existing) => existing.toLowerCase() === tag.toLowerCase())) tags.push(tag);
  }
  return tags;
}

export function validPublicPath(path: unknown): path is string {
  return typeof path === "string" && path.length <= 160
    && /^(\/(?:vote|predictions|leaderboard|winners|verify|tickets|contestants|loyalty|organize|faq|security|seatmap)(?:\/[a-zA-Z0-9_-]+)*|\/)$/.test(path);
}

export function validAmendment(old: { options: string[]; flags: (string | null)[]; closeTime: Date }, next: { options: string[]; flags: (string | null)[]; closeTime: Date }) {
  return next.options.length >= old.options.length && next.options.length <= 256
    && old.options.every((label, i) => next.options[i] === label && (next.flags[i] ?? null) === (old.flags[i] ?? null))
    && next.closeTime.getTime() >= old.closeTime.getTime()
    && next.closeTime.getTime() > Date.now();
}
