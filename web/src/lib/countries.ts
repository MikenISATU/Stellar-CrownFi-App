const COUNTRY_CODES = `AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CP CR CU CV CW CX CY CZ DE DG DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW`.split(" ");

const displayNames = new Intl.DisplayNames(["en"], { type: "region" });

export type CountryOption = { code: string; name: string };

// Pageants occasionally treat the four UK nations as separate delegations. Their
// flag assets are already bundled with the app, so preserve those real flags rather
// than incorrectly replacing each one with the Union Jack.
const PAGEANT_REGION_OPTIONS: CountryOption[] = [
  { code: "GB-ENG", name: "England" },
  { code: "GB-NIR", name: "Northern Ireland" },
  { code: "GB-SCT", name: "Scotland" },
  { code: "GB-WLS", name: "Wales" },
];

export const COUNTRY_OPTIONS: CountryOption[] = [
  ...COUNTRY_CODES.map((code) => ({ code, name: displayNames.of(code) ?? code })),
  ...PAGEANT_REGION_OPTIONS,
]
  .sort((a, b) => a.name.localeCompare(b.name));

function normalizedCountryName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const CODE_BY_NAME = new Map(COUNTRY_OPTIONS.map((country) => [normalizedCountryName(country.name), country.code]));

// Common pageant/CSV spellings that differ from Intl.DisplayNames' current names.
// Keeping these aliases locally makes imports deterministic and avoids an API key,
// rate limits, or a third-party request for every candidate.
const COUNTRY_ALIASES: Record<string, string> = {
  "bosnia herzegovina": "BA",
  "british virgin islands": "VG",
  "brunei darussalam": "BN",
  "burma": "MM",
  "cape verde": "CV",
  "china pr": "CN",
  "china prc": "CN",
  "chinese taipei": "TW",
  "congo brazzaville": "CG",
  "congo kinshasa": "CD",
  "czech republic": "CZ",
  "democratic republic of congo": "CD",
  "dr congo": "CD",
  "east timor": "TL",
  "ivory coast": "CI",
  "korea": "KR",
  "laos": "LA",
  "macau": "MO",
  "moldova": "MD",
  "myanmar": "MM",
  "palestine": "PS",
  "republic of korea": "KR",
  "russia": "RU",
  "south korea": "KR",
  "swaziland": "SZ",
  "syria": "SY",
  "tanzania": "TZ",
  "the bahamas": "BS",
  "the gambia": "GM",
  "timor leste": "TL",
  "trinidad tobago": "TT",
  "turkiye": "TR",
  "united states of america": "US",
  "us virgin islands": "VI",
  "usa": "US",
  "venezuela": "VE",
  "vietnam": "VN",
};

for (const [name, code] of Object.entries(COUNTRY_ALIASES)) {
  CODE_BY_NAME.set(normalizedCountryName(name), code);
}

const FLAG_CODES = new Set(COUNTRY_OPTIONS.map((country) => country.code));

export function normalizeFlagCode(value?: string | null): string {
  const normalized = String(value ?? "").trim().toUpperCase();
  return FLAG_CODES.has(normalized) ? normalized : "";
}

export function countryName(code?: string | null): string {
  const normalized = normalizeFlagCode(code);
  return COUNTRY_OPTIONS.find((country) => country.code === normalized)?.name ?? "";
}

export function countryCodeFor(value?: string | null): string {
  const normalized = String(value ?? "").trim();
  if (!normalized) return "";
  const code = normalizeFlagCode(normalized);
  if (code) return code;
  return CODE_BY_NAME.get(normalizedCountryName(normalized)) ?? "";
}

// Legacy markets sometimes stored "Country — Candidate" (or only the country)
// without an explicit flag code. Infer a display-only flag so those markets render
// correctly without rewriting their immutable/auditable market data.
export function countryCodeFromOutcomeLabel(label?: string | null): string {
  const normalized = String(label ?? "").trim();
  if (!normalized) return "";
  const exact = countryCodeFor(normalized);
  if (exact) return exact;
  const [countryPrefix] = normalized.split(/\s+(?:—|–|-)\s+/, 1);
  return countryCodeFor(countryPrefix);
}
