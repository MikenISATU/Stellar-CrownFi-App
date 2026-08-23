import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isLikelyStellarAddress } from "@/lib/adminAuth";
import { verifyFanSignature, createFanSession, setFanCookie } from "@/lib/fanAuth";
import { clientIpHash } from "@/lib/ip";

// Anti-abuse: max NEW accounts per network (IP). Returning wallets are never capped.
const MAX_ACCOUNTS_PER_IP = Number(process.env.MAX_ACCOUNTS_PER_IP ?? "2");

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
