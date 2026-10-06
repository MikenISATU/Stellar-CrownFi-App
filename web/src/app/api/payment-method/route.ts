import { NextResponse } from "next/server";
import { getSettings } from "@/lib/settings";
import { getProviderMeta, GCASH_ENABLED } from "@/lib/payments";

// Public (non-sensitive) view of the active payment method, so the buy UI can adapt — e.g. show
// a "Pay with GCash" option when the admin has enabled GCash as the active provider.
export async function GET() {
  try {
    const s = await getSettings();
    const meta = getProviderMeta(s.activeProvider);
    return NextResponse.json({
      enabled: s.paymentsEnabled && !s.maintenanceMode,
      maintenance: s.maintenanceMode,
      provider: s.activeProvider,
      label: meta.label,
      gcash: GCASH_ENABLED && !!meta.capabilities.gcash,
      environment: s.environment, // testnet | production
    });
  } catch {
    return NextResponse.json({ enabled: true, maintenance: false, provider: "testnet_usdc", label: "Testnet USDC (Stellar)", gcash: false, environment: "testnet" });
  }
}
