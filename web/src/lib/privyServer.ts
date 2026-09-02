// Server-side Privy helper. Kept in one place so the (version-sensitive) Privy API
// surface is isolated. Uses Privy's maintained Node SDK to VERIFY the client's access token and to
// PROVISION a Stellar wallet for the user — so we never rely on fragile client-side
// Stellar signing.

import { PrivyClient } from "@privy-io/node";

export function privyConfigured(): boolean {
  const appId = process.env.PRIVY_APP_ID || process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  return Boolean(appId && process.env.PRIVY_APP_SECRET);
}

function getPrivyClient(): PrivyClient {
  const appId = process.env.PRIVY_APP_ID || process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const secret = process.env.PRIVY_APP_SECRET;
  if (!appId || !secret) throw new Error("privy_not_configured");
  return new PrivyClient({ appId, appSecret: secret });
}

export type PrivyStellarIdentity = { userId: string; email: string | null; address: string };

// Verify a Privy access token, then resolve (or create) the user's Stellar wallet.
// NOTE: Privy's default embedded wallet is EVM — a Stellar (ed25519) wallet must be
// created explicitly with chainType "stellar". Field shapes follow Privy's server SDK;
// re-confirm against current docs if the SDK version bumps.
export async function resolvePrivyStellarIdentity(token: string): Promise<PrivyStellarIdentity> {
  const privy = await getPrivyClient();
  const claims = await privy.utils().auth().verifyAccessToken(token);
  const userId = claims.user_id;

  const user: any = await privy.users()._get(userId);
  const accounts: any[] = user?.linked_accounts ?? [];

  const email: string | null =
    accounts.find((a) => a.type === "email")?.address ??
    accounts.find((a) => a.type === "google_oauth")?.email ??
    null;

  // Find an existing Stellar wallet on the account…
  let address: string | undefined = accounts.find(
    (a) => a.type === "wallet" && a.chain_type === "stellar",
  )?.address;

  // …or create one (explicit chainType "stellar"), owned by the Privy user.
  if (!address) {
    const wallet = await privy.wallets().create({ chain_type: "stellar", owner: { user_id: userId } });
    address = wallet?.address;
  }

  if (!address) throw new Error("no_stellar_wallet");
  return { userId, email, address };
}

// NOTE on signing: Privy Stellar wallets here are USER-owned (created with owner.userId), so
// the server cannot sign for them — by design. Signing happens client-side via
// useSignRawHash (see session/PrivySignerBridge.tsx + api/wallet/privy-sign).

// Testnet: make sure the Stellar account exists on-chain (friendbot-fund it once) so it can
// be a transaction source and pay fees. Idempotent — a fast no-op for funded accounts.
export async function ensureFundedOnTestnet(address: string): Promise<void> {
  const S: any = await import("@stellar/stellar-sdk");
  const rpc = new S.rpc.Server(process.env.STELLAR_RPC_URL ?? "https://soroban-testnet.stellar.org");
  try {
    await rpc.getAccount(address);
    return; // already exists
  } catch {
    /* not found — fund below */
  }
  const r = await fetch(`https://friendbot.stellar.org/?addr=${encodeURIComponent(address)}`);
  if (!r.ok && r.status !== 400) {
    // 400 = already funded (race) — anything else is a real failure worth surfacing.
    throw new Error(`friendbot_${r.status}`);
  }
}
