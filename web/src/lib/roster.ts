// Canonical delegate roster. Source of truth for candidate imagery/metadata and a
// no-database fallback so the design renders even before Supabase is configured.
// Keyed to the real asset files copied into /public/candidates and /public/nfts.

export type RosterEntry = {
  id: string; // slug — used as the fallback contestant id
  name: string;
  country: string;
  sash: string; // ISO-2 country code (drives the flag)
  continent: string;
  height: string;
  photo: string; // /candidates/<slug>.png
  nft?: string; // /nfts/<slug>.png (pre-made trading card, when available)
  priceUsdc: number;
};

// Five delegates for now — the ones with finished NFT collectible cards.
export const ROSTER: RosterEntry[] = [
  { id: "philippines", name: "Isabel Reyes", country: "Philippines", sash: "PH", continent: "Asia", height: "5'8\"", photo: "/candidates/philippines.webp", nft: "/nfts/philippines.webp", priceUsdc: 50 },
  { id: "indonesia",   name: "Ayu Lestari",  country: "Indonesia",   sash: "ID", continent: "Asia", height: "5'9\"", photo: "/candidates/indonesia.webp", nft: "/nfts/indonesia.webp", priceUsdc: 50 },
  { id: "thailand",    name: "Ratana Somsri", country: "Thailand",   sash: "TH", continent: "Asia", height: "5'8\"", photo: "/candidates/thailand.webp", nft: "/nfts/thailand.webp", priceUsdc: 50 },
  { id: "japan",       name: "Mai Tanaka",   country: "Japan",       sash: "JP", continent: "Asia", height: "5'6\"", photo: "/candidates/japan.webp", nft: "/nfts/japan.webp", priceUsdc: 50 },
  { id: "vietnam",     name: "Linh Nguyen",  country: "Vietnam",     sash: "VN", continent: "Asia", height: "5'7\"", photo: "/candidates/vietnam.webp", nft: "/nfts/vietnam.webp", priceUsdc: 50 },
];

export const rosterBySash: Record<string, RosterEntry> = Object.fromEntries(ROSTER.map((r) => [r.sash, r]));
export const rosterById: Record<string, RosterEntry> = Object.fromEntries(ROSTER.map((r) => [r.id, r]));

// Enrich a DB contestant (name/country/sash/portraitUrl) with display-only metadata
// (continent/height/nft) from the roster, matched by sash. Falls back to sensible defaults.
export function rosterMeta(sash: string): { continent: string; height: string; nft?: string; photo?: string } {
  const r = rosterBySash[sash];
  return { continent: r?.continent ?? "Asia", height: r?.height ?? "—", nft: r?.nft, photo: r?.photo };
}
