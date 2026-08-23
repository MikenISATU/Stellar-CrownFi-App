// ─────────────────────────────────────────────────────────────────────────────
// KYC gate (money-out path)
//
// Design decision (see docs/security/onboarding-and-anti-abuse.md): CrownFi does NOT
// KYC for voting or small buys. KYC applies only on the money-OUT side — payouts and
// withdrawals — to keep friction and PII exposure low for everyday fans.
//
// The verification itself is performed by an EXTERNAL provider (Persona / Sumsub /
// Onfido / Veriff) or via a Stellar anchor's SEP-12 flow. This module does NOT verify
// anyone — it only reads the status stored on the Fan (`kycStatus`) and decides whether
// a gated action may proceed. A provider webhook flips `kycStatus` to "verified".
//
// No raw identity documents are ever stored in CrownFi — only the status + the
// provider's reference id (add a `kycRef` field when a provider is wired).
// ─────────────────────────────────────────────────────────────────────────────

export type KycStatus = "none" | "pending" | "verified" | "rejected";

export function isKycVerified(fan: { kycStatus?: string | null }): boolean {
  return (fan?.kycStatus ?? "none") === "verified";
}

/**
 * Gate a money-out action on KYC status.
 * @returns null when the fan may proceed, or an error code to surface via messages.ts.
 */
export function kycGate(fan: { kycStatus?: string | null }): "kyc_required" | "kyc_pending" | null {
  const status = (fan?.kycStatus ?? "none") as KycStatus;
  if (status === "verified") return null;
  if (status === "pending") return "kyc_pending";
  return "kyc_required"; // none | rejected
}
