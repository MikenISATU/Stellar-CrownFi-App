// Server-side Privy helper. Kept in one place so the (version-sensitive) Privy API
// surface is isolated. Uses server-auth to VERIFY the client's auth token and to
// PROVISION a Stellar wallet for the user — so we never rely on fragile client-side
// Stellar signing.

export function privyConfigured(): boolean {
  const appId = process.env.PRIVY_APP_ID || process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  return Boolean(appId && process.env.PRIVY_APP_SECRET);
}

async function getPrivyClient(): Promise<any> {
  const appId = process.env.PRIVY_APP_ID || process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const secret = process.env.PRIVY_APP_SECRET;
  if (!appId || !secret) throw new Error("privy_not_configured");
  const mod: any = await import("@privy-io/server-auth");
  return new mod.PrivyClient(appId, secret);
}

export type PrivyStellarIdentity = { userId: string; email: string | null; address: string };

// Verify a Privy access token, then resolve (or create) the user's Stellar wallet.
// NOTE: Privy's default embedded wallet is EVM — a Stellar (ed25519) wallet must be
// created explicitly with chainType "stellar". Field shapes follow Privy's server SDK;
// re-confirm against current docs if the SDK version bumps.
export async function resolvePrivyStellarIdentity(token: string): Promise<PrivyStellarIdentity> {
  const dbg = (...a: any[]) => console.log("[privy-debug]", ...a);

  const privy = await getPrivyClient();
  dbg("client ready; verifying token (len=%d)…", token.length);

  const claims = await privy.verifyAuthToken(token);
  const userId: string = claims.userId;
  dbg("token OK · userId =", userId);

  const user: any = await privy.getUser(userId).catch((e: any) => {
    dbg("getUser FAILED:", e?.message ?? e);
    return null;
  });
  const accounts: any[] = user?.linkedAccounts ?? [];
  dbg("linkedAccounts types =", accounts.map((a) => `${a.type}${a.chainType ? `:${a.chainType}` : ""}`).join(", ") || "(none)");

  const email: string | null =
    user?.email?.address ??
    accounts.find((a) => a.type === "email")?.address ??
    null;

  // Find an existing Stellar wallet on the account…
  let address: string | undefined = accounts.find(
    (a) => a.type === "wallet" && a.chainType === "stellar",
  )?.address;
  dbg("existing stellar wallet =", address ?? "(none)");

  // …or create one (explicit chainType "stellar"), owned by the Privy user.
  if (!address) {
    dbg("creating stellar wallet via walletApi.createWallet…");
    const wallet: any = await privy.walletApi.createWallet({ chainType: "stellar", owner: { userId } });
    address = wallet?.address;
    dbg("createWallet returned address =", address ?? "(none)", "raw keys:", wallet ? Object.keys(wallet).join(",") : "null");
  }

  if (!address) throw new Error("no_stellar_wallet");
  dbg("resolved identity · email =", email ?? "(none)", "· address =", address);
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

