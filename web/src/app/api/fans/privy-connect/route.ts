import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isLikelyStellarAddress } from "@/lib/adminAuth";
import { createFanSession, setFanCookie } from "@/lib/fanAuth";
import { clientIpHash } from "@/lib/ip";
import { privyConfigured, resolvePrivyStellarIdentity, ensureFundedOnTestnet } from "@/lib/privyServer";

const MAX_ACCOUNTS_PER_IP = Number(process.env.MAX_ACCOUNTS_PER_IP ?? "2");

// Web2 sign-in via Privy: the client sends its Privy access token; the server verifies it
// (proof of identity), provisions the user's Stellar wallet, links/creates the Fan, and
// opens a CrownFi session cookie. No client-side Stellar signature needed — the verified
// Privy token is the proof.
export async function POST(req: NextRequest) {
  if (!privyConfigured()) {
    return NextResponse.json({ error: "privy_not_configured" }, { status: 501 });
  }

  const body = await req.json().catch(() => null);
  const token = String(body?.token ?? "");
  if (!token) return NextResponse.json({ error: "missing_token" }, { status: 400 });

  let identity;
  try {
    identity = await resolvePrivyStellarIdentity(token);
  } catch (e: any) {
    // TEMP DEBUG: include the real message so it shows in the browser Network tab.
    const detail = e?.message ?? String(e);
    console.error("[api/fans/privy-connect] Privy verify/provision failed:", detail, e);
    return NextResponse.json({ error: "privy_error", detail }, { status: 502 });
  }

  const { email, address } = identity;
  if (!isLikelyStellarAddress(address)) {
    return NextResponse.json({ error: "privy_error" }, { status: 502 });
  }

  // Testnet: the Privy wallet must exist ON-CHAIN before it can source any transaction.
  // Idempotent (friendbot once, then a no-op) — covers new signups AND pre-existing accounts
  // created before funding was wired in. Best-effort: login should not fail if friendbot is down.
  await ensureFundedOnTestnet(address).catch((e) =>
    console.warn("[api/fans/privy-connect] funding skipped:", e?.message ?? e)
  );

  const ipHash = clientIpHash(req);

  try {
    const existing = await db.fan.findUnique({ where: { walletAddress: address } });
    if (existing) {
      if (email && existing.email && existing.email !== email) {
        return NextResponse.json({ error: "wallet_linked_elsewhere" }, { status: 409 });
      }
      const fan = email && !existing.email
        ? await db.fan.update({ where: { id: existing.id }, data: { email } })
        : existing;
      const res = NextResponse.json(fan);
      setFanCookie(res, createFanSession(fan.id, address));
      return res;
    }

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
      data: { handle: `fan_${address.slice(-6)}`, walletAddress: address, email, registrationIpHash: ipHash, authProvider: "privy" },
    });
    const res = NextResponse.json(fan);
    setFanCookie(res, createFanSession(fan.id, address));
    return res;
  } catch (e) {
    console.error("[api/fans/privy-connect] db error:", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
