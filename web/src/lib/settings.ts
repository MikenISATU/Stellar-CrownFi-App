import { db } from "@/lib/db";

// Platform settings singleton (payments + KYC + environment). Read anywhere; edited by admin.

export type Settings = {
  id: string;
  paymentsEnabled: boolean;
  kycEnabled: boolean;
  kycMandatory: boolean;
  environment: string; // testnet | production
  activeProvider: string;
  maintenanceMode: boolean;
  winnersAnnounced: boolean;
  providerConfig: string | null;
};

const DEFAULTS: Omit<Settings, "id"> = {
  paymentsEnabled: true,
  kycEnabled: false,
  kycMandatory: false,
  environment: "testnet",
  activeProvider: "testnet_usdc",
  maintenanceMode: false,
  winnersAnnounced: false,
  providerConfig: null,
};

// Settings are read on nearly every request but change rarely, so cache them briefly in memory.
// (Reads used to be an upsert — a DB WRITE on every read, ~900ms per call.)
let cache: { at: number; val: Settings } | null = null;
const CACHE_MS = 30_000;

export async function getSettings(): Promise<Settings> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.val;
  try {
    const found = await db.platformSettings.findUnique({ where: { id: "singleton" } });
    const s = found ?? (await db.platformSettings.create({ data: { id: "singleton" } }));
    const val = s as unknown as Settings;
    cache = { at: Date.now(), val };
    return val;
  } catch {
    return { id: "singleton", ...DEFAULTS };
  }
}

// Whether paid actions (mint, tickets, stakes) may proceed right now — enforced server-side by
// the paid endpoints so the admin toggles actually gate purchases (not just display).
export async function paymentsAllowed(): Promise<{ ok: true } | { ok: false; reason: "maintenance" | "payments_disabled" }> {
  const s = await getSettings();
  if (s.maintenanceMode) return { ok: false, reason: "maintenance" };
  if (!s.paymentsEnabled) return { ok: false, reason: "payments_disabled" };
  return { ok: true };
}

const EDITABLE = ["paymentsEnabled", "kycEnabled", "kycMandatory", "environment", "activeProvider", "maintenanceMode", "winnersAnnounced", "providerConfig"] as const;

export async function updateSettings(patch: Record<string, any>): Promise<Settings> {
  const data: Record<string, any> = {};
  for (const k of EDITABLE) if (k in patch) data[k] = patch[k];
  if ("environment" in data && !["testnet", "production"].includes(data.environment)) delete data.environment;
  const s = await db.platformSettings.upsert({
    where: { id: "singleton" },
    update: data,
    create: { id: "singleton", ...data },
  });
  cache = { at: Date.now(), val: s as unknown as Settings }; // keep the read cache in sync
  return s as unknown as Settings;
}
