import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readFanSession } from "@/lib/fanAuth";

// Silent session restore on page load — no wallet popup. Returns the signed-in
// fan if the httpOnly session cookie is still valid, else 401.
export async function GET(req: NextRequest) {
  const session = readFanSession(req);
  if (!session) return NextResponse.json({ error: "fan_auth_required" }, { status: 401 });

  try {
    const fan = await db.fan.findUnique({ where: { id: session.fanId } });
    if (fan) return NextResponse.json(fan);
    // Fan row missing (e.g. address changed) — fall back to session identity.
  } catch {
    /* DB unavailable — fall back to session identity below. */
  }
  return NextResponse.json({
    id: session.fanId,
    handle: `fan_${session.address.slice(-6)}`,
    walletAddress: session.address,
    points: 0,
  });
}
