import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isLikelyStellarAddress } from "@/lib/adminAuth";
import { verifyFanSignature, createFanSession, setFanCookie } from "@/lib/fanAuth";
import { clientIpHash } from "@/lib/ip";

const MAX_ACCOUNTS_PER_IP = Number(process.env.MAX_ACCOUNTS_PER_IP ?? "2");

// ─────────────────────────────────────────────────────────────────────────────
// Web2-friendly onboarding (Privy embedded wallets).
//
// Flow:
//   1. User signs in with email / Google / passkey (Privy) — no seed phrase.
//   2. Privy provisions an embedded wallet. Its DEFAULT chain is EVM (ETH), so we
//      EXPLICITLY create a Stellar wallet with chainType "stellar" (see src/wallet/index.ts).
//   3. The client posts that Stellar address here to push it to the DB and open a session.
//
// Because the embedded wallet can sign, we still require a Stellar signature over the
// challenge (same proof-of-control as Freighter). The extra `email` lets us detect and
// friendly-notify when a wallet is already linked to a DIFFERENT account.
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null);
  const walletAddress = String(b?.walletAddress ?? b?.address ?? "").trim();
  const message = String(b?.message ?? "");
  const signature = String(b?.signature ?? "");
  const email = b?.email ? String(b.email).trim().toLowerCase() : null;

  if (!isLikelyStellarAddress(walletAddress)) {
    return NextResponse.json({ error: "invalid_address" }, { status: 400 });
  }
  if (!message || !signature) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }

  const verified = await verifyFanSignature({ address: walletAddress, message, signature });
  if (!verified.ok) {
    return NextResponse.json({ error: verified.error }, { status: verified.status });
  }

  const ipHash = clientIpHash(req);

  try {
    const existing = await db.fan.findUnique({ where: { walletAddress } });
    if (existing) {
      // Wallet already belongs to an account — is it THIS user's?
      if (email && existing.email && existing.email !== email) {
        return NextResponse.json({ error: "wallet_linked_elsewhere" }, { status: 409 });
      }
      // Same user (or wallet-only account being upgraded with an email) → attach email if new.
      const fan = email && !existing.email
        ? await db.fan.update({ where: { id: existing.id }, data: { email } })
        : existing;
      const res = NextResponse.json(fan);
      setFanCookie(res, createFanSession(fan.id, walletAddress));
      return res;
    }

    // If this email already has an account, don't silently create a second one.
    if (email) {
      const byEmail = await db.fan.findUnique({ where: { email } });
      if (byEmail) return NextResponse.json({ error: "wallet_linked_elsewhere" }, { status: 409 });
    }

    if (ipHash) {
      const fromThisIp = await db.fan.count({ where: { registrationIpHash: ipHash } });
      if (fromThisIp >= MAX_ACCOUNTS_PER_IP) {
        return NextResponse.json({ error: "ip_registration_limit" }, { status: 429 });
      }
    }

    const fan = await db.fan.create({
      data: { handle: `fan_${walletAddress.slice(-6)}`, walletAddress, email, registrationIpHash: ipHash, authProvider: "privy" },
    });
    const res = NextResponse.json(fan);
    setFanCookie(res, createFanSession(fan.id, walletAddress));
    return res;
  } catch (e) {
    console.warn("[api/fans/link-wallet] database error:", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
