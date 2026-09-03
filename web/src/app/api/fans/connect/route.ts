import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isLikelyStellarAddress } from "@/lib/adminAuth";
import { verifyFanSignature, createFanSession, setFanCookie } from "@/lib/fanAuth";
import { clientIpHash } from "@/lib/ip";
import { ensureFundedOnTestnet } from "@/lib/privyServer";
import { mintTestUsdc } from "@/lib/stellar";

// Anti-abuse: max NEW accounts per network (IP). Returning wallets are never capped.
// Shared event/office Wi-Fi is normal for CrownFi. Keep a high anti-bot ceiling instead
// of blocking the third legitimate attendee behind the same public IP.
const MAX_ACCOUNTS_PER_IP = Math.max(20, Number(process.env.MAX_ACCOUNTS_PER_IP ?? "20") || 20);
const IS_TESTNET = !["public", "mainnet"].includes((process.env.STELLAR_NETWORK ?? "testnet").toLowerCase());

async function fundNewTestnetWallet(walletAddress: string) {
  if (!IS_TESTNET) return;
  await ensureFundedOnTestnet(walletAddress);
  await mintTestUsdc({ toAddress: walletAddress, amountUsdc: 50 });
}

// Step 2 of wallet sign-in: verify the Freighter signature proves control of the
// address, then issue an httpOnly session cookie. fanId is never trusted from the
// client afterwards — routes read it from this session.
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null);
  const walletAddress = String(b?.walletAddress ?? b?.address ?? "").trim();
  const message = String(b?.message ?? "");
  const signature = String(b?.signature ?? "");

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
    // Returning wallet → just re-issue the session (no registration cap).
    const existing = await db.fan.findUnique({ where: { walletAddress } });
    if (existing) {
      const res = NextResponse.json(existing);
      setFanCookie(res, createFanSession(existing.id, walletAddress));
      return res;
    }

    // New account → enforce the per-IP registration cap.
    if (ipHash) {
      const fromThisIp = await db.fan.count({ where: { registrationIpHash: ipHash } });
      if (fromThisIp >= MAX_ACCOUNTS_PER_IP) {
        return NextResponse.json({ error: "ip_registration_limit" }, { status: 429 });
      }
    }

    const fan = await db.fan.create({
      data: { handle: `fan_${walletAddress.slice(-6)}`, walletAddress, registrationIpHash: ipHash, authProvider: "freighter" },
    });
    // Give a brand-new testnet user enough demo balance to make their first
    // prediction. Funding is best-effort so a temporary faucet outage cannot
    // lock the user out of their account; the in-app faucet remains available.
    await fundNewTestnetWallet(walletAddress).catch((e) =>
      console.warn("[api/fans/connect] starter funding skipped:", e?.message ?? e)
    );
    const res = NextResponse.json(fan);
    setFanCookie(res, createFanSession(fan.id, walletAddress));
    return res;
  } catch (e) {
    console.warn("[api/fans/connect] database unavailable, connecting with mock fan.");
    const mockId = `mock-fan-${walletAddress.slice(-6)}`;
    const res = NextResponse.json({
      id: mockId,
      handle: `fan_${walletAddress.slice(-6)}`,
      walletAddress,
      points: 0,
      createdAt: new Date().toISOString(),
    });
    setFanCookie(res, createFanSession(mockId, walletAddress));
    return res;
  }
}
