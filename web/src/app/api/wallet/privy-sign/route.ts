import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireFan } from "@/lib/fanAuth";
import { privyConfigured, ensureFundedOnTestnet } from "@/lib/privyServer";

const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";

// Signing support for Privy (email/Google) fans. Their Stellar wallet lives in Privy's TEE
// and only the USER'S client can sign with it (self-custodial), so the flow is:
//
//   1. { xdr }                → server validates the tx and returns the hash to sign
//   2. client                 → Privy's useSignRawHash signs the hash (user custody)
//   3. { xdr, signature }     → server verifies the signature against the session wallet,
//                               attaches it, and returns the submittable signedXdr
//
// Guardrails: session-gated, privy accounts only, tx source must equal the session wallet,
// testnet passphrase pinned, and the attach step re-verifies the ed25519 signature.
export async function POST(req: NextRequest) {
  const auth = requireFan(req);
  if (auth instanceof NextResponse) return auth;
  if (!privyConfigured()) return NextResponse.json({ error: "privy_not_configured" }, { status: 501 });

  const b = await req.json().catch(() => null);
  const xdr = String(b?.xdr ?? "");
  const signature = b?.signature ? String(b.signature) : null;
  if (!xdr) return NextResponse.json({ error: "missing_xdr" }, { status: 400 });

  const fan = await db.fan.findUnique({ where: { id: auth.fanId } });
  if (!fan || fan.authProvider !== "privy" || fan.walletAddress !== auth.address) {
    return NextResponse.json({ error: "not_a_privy_wallet" }, { status: 403 });
  }

  try {
    const S: any = await import("@stellar/stellar-sdk");
    const tx = S.TransactionBuilder.fromXDR(xdr, TESTNET_PASSPHRASE);
    if (tx.source !== auth.address) {
      return NextResponse.json({ error: "source_mismatch" }, { status: 403 });
    }
    const hash: Buffer = tx.hash();

    // Step 1 — hand back the hash to sign (and make sure the account can pay fees).
    if (!signature) {
      await ensureFundedOnTestnet(auth.address).catch(() => {});
      return NextResponse.json({ hash: "0x" + hash.toString("hex") });
    }

    // Step 2 — verify the user's signature and attach it.
    const sig = Buffer.from(signature.replace(/^0x/, ""), "hex");
    const kp = S.Keypair.fromPublicKey(auth.address);
    if (sig.length !== 64 || !kp.verify(hash, sig)) {
      return NextResponse.json({ error: "bad_signature" }, { status: 400 });
    }
    tx.signatures.push(new S.xdr.DecoratedSignature({ hint: kp.signatureHint(), signature: sig }));
    return NextResponse.json({ signedXdr: tx.toXDR() });
  } catch (e: any) {
    console.error("[api/wallet/privy-sign] failed:", e);
    return NextResponse.json({ error: e?.message ?? "sign_failed" }, { status: 500 });
  }
}
