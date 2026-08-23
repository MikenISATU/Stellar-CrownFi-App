import { NextRequest, NextResponse } from "next/server";
import { createFanChallenge } from "@/lib/fanAuth";
import { isLikelyStellarAddress } from "@/lib/adminAuth";

// Step 1 of wallet sign-in: hand the client a one-time message to sign in Freighter.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const address = String(body?.address ?? "").trim();
  if (!isLikelyStellarAddress(address)) {
    return NextResponse.json({ error: "invalid_address" }, { status: 400 });
  }
  const { message, expiresAt } = createFanChallenge(address, req);
  return NextResponse.json({ message, expiresAt });
}
