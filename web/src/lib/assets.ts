// Asset-folder convention for pageant uploads.
//
//   /assets/pageants/<pageant-slug>/
//     candidates/<candidate-slug>/
//       profile/        swimsuit/        long-gown/        nft-artwork/
//
// Dev implementation stores under web/public/assets/... (web-served). The functions
// below only BUILD paths — the actual write goes through a storage adapter so prod can
// swap to Supabase Storage / Pinata (IPFS) without changing call sites.

export const ASSET_ROOT = "/assets/pageants";

// DB categoryKey → folder segment (underscores → hyphens; extensible).
export function folderForKind(kind: string): string {
  return kind.replace(/_/g, "-");
}

export function pageantDir(pageantSlug: string): string {
  return `${ASSET_ROOT}/${pageantSlug}`;
}

export function candidateDir(pageantSlug: string, candidateSlug: string): string {
  return `${pageantDir(pageantSlug)}/candidates/${candidateSlug}`;
}

// Public URL for a candidate asset of a given kind (profile | swimsuit | long_gown | nft_artwork | …).
export function assetPath(pageantSlug: string, candidateSlug: string, kind: string, filename: string): string {
  return `${candidateDir(pageantSlug, candidateSlug)}/${folderForKind(kind)}/${filename}`;
}

// Recognised upload kinds (competition photos + profile + collectible artwork).
export const CANDIDATE_ASSET_KINDS = ["profile", "swimsuit", "long_gown", "nft_artwork"] as const;
export type CandidateAssetKind = (typeof CANDIDATE_ASSET_KINDS)[number];
