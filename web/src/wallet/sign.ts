"use client";
import type { Fan } from "@/session/SessionProvider";
import { signWithFreighter } from "@/wallet/freighter";
import { getPrivySigner } from "@/wallet/privySigner";
import { shouldUseFreighterMobile, signWithFreighterMobile } from "@/wallet/freighterMobile";

// One signing door for every paid flow. Freighter fans approve in the extension popup;
// Privy (email/Google) fans have no extension — their wallet lives server-side in Privy's
// TEE, so the app signs through /api/wallet/privy-sign (session-gated, source-checked).
export async function signTx(
  xdr: string,
  fan: Pick<Fan, "walletAddress"> & { authProvider?: string | null }
): Promise<{ signedXdr?: string; error?: string }> {
  if (fan.authProvider === "privy") {
    try {
      const signer = getPrivySigner();
      if (!signer) return { error: "Your account wallet isn’t ready yet — reload the page and try again." };

      // 1) Server validates the tx and returns the hash to sign.
      const hr = await fetch("/api/wallet/privy-sign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ xdr }),
      });
      const hd = await hr.json().catch(() => ({}));
      if (!hr.ok || !hd.hash) return { error: hd.error ?? "Could not prepare the signature." };

      // 2) The user's Privy wallet signs the hash (keys never leave Privy).
      const { signature } = await signer({ address: fan.walletAddress, chainType: "stellar", hash: hd.hash });

      // 3) Server verifies + attaches the signature.
      const ar = await fetch("/api/wallet/privy-sign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ xdr, signature }),
      });
      const ad = await ar.json().catch(() => ({}));
      if (!ar.ok || !ad.signedXdr) return { error: ad.error ?? "Could not sign with your account wallet." };
      return { signedXdr: ad.signedXdr };
    } catch (e: any) {
      return { error: e?.message ?? "Could not sign with your account wallet." };
    }
  }
  if (shouldUseFreighterMobile()) return signWithFreighterMobile(xdr);
  return signWithFreighter(xdr, fan.walletAddress);
}
