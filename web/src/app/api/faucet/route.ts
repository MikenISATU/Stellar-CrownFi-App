import { NextRequest, NextResponse } from "next/server";
import { mintTestUsdc } from "@/lib/stellar";
import { rateLimit } from "@/lib/ratelimit";
import { clientIp } from "@/lib/ip";
import { requireFan } from "@/lib/fanAuth";

// Test-USDC faucet: mints demo USDC to a wallet so it can buy collectibles.
// Owner-signed by the platform (the token owner). Testnet only.
export async function POST(req: NextRequest) {
  const auth = requireFan(req);
  if (auth instanceof NextResponse) return auth;

  const rl = rateLimit(`faucet:${clientIp(req)}`);
  if (!rl.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  // Only ever faucet to the signed-in wallet.
  const walletAddress = auth.address;
  if (!walletAddress.startsWith("G") || walletAddress.length < 20)
    return NextResponse.json({ error: "invalid_address" }, { status: 400 });

  const body = await req.json().catch(() => null);
  // Cap matches the priciest thing you can buy in one go (a 200 USDC Diamond ticket),
  // so a single top-up always covers the tab you're standing on. Testnet play money.
  const amountUsdc = Number(body?.amountUsdc ?? 50);
  if (!Number.isFinite(amountUsdc) || amountUsdc <= 0 || amountUsdc > 200)
    return NextResponse.json({ error: "invalid_amount" }, { status: 400 });
  try {
    const res = await mintTestUsdc({ toAddress: walletAddress, amountUsdc });
    return NextResponse.json({ ok: true, amountUsdc, ...res });
  } catch (e: any) {
    console.error("[api/faucet] mint failed:", e);
    return NextResponse.json({ error: e?.message ?? "faucet_failed" }, { status: 500 });
  }
}
