// The pageant progression — the single source of truth for the competition stages, shared
// by prediction markets (categories) and voting (rounds). Order = order of the night.
export const PAGEANT_SEGMENTS = [
  { key: "swimsuit", label: "Top 20 · Swimsuit", short: "Swimsuit" },
  { key: "long_gown", label: "Top 10 · Long Gown", short: "Long Gown" },
  { key: "qa", label: "Top 5 · Question & Answer", short: "Q&A" },
  { key: "overall", label: "Overall Winner", short: "Overall" },
] as const;

export type SegmentKey = (typeof PAGEANT_SEGMENTS)[number]["key"];

// Prediction-market categories are deliberately separate from voting rounds: creators can
// open a market for any stage, while voting remains limited to PAGEANT_SEGMENTS.
export const MARKET_CATEGORIES = [
  { key: "preliminary", label: "Preliminary", short: "Preliminary" },
  { key: "national_costume", label: "National Costume Round", short: "Costume" },
  { key: "swimsuit", label: "Swimsuit Round", short: "Swimsuit" },
  { key: "long_gown", label: "Long Gown Round", short: "Long Gown" },
  { key: "qa", label: "Question & Answer Round", short: "Q&A" },
  { key: "overall", label: "Overall Winner", short: "Overall" },
  { key: "other", label: "Other", short: "Other" },
] as const;

export const CATEGORY_LABEL: Record<string, string> = {
  ...Object.fromEntries(MARKET_CATEGORIES.map((s) => [s.key, s.label])),
  // Back-compat for markets created before earlier segment renames.
  first_runner_up: "First Runner-Up",
  winner: "Overall Winner",
  talent: "Talent",
  costume: "National Costume",
  general: "Other",
};

// Default banner art per category (drop images in web/public/categories/ — see the README there).
export function categoryImage(category: string): string {
  return `/categories/${category}.webp`;
}
