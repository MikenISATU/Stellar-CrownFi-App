import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireFan } from "@/lib/fanAuth";

// POST — rename the signed-in fan's handle (display name). fanId from the verified session.
export async function POST(req: NextRequest) {
  const auth = requireFan(req);
  if (auth instanceof NextResponse) return auth;

  const b = await req.json().catch(() => null);
  const handle = String(b?.handle ?? "").trim();
  if (!/^[a-zA-Z0-9_ ]{3,24}$/.test(handle)) {
    return NextResponse.json({ error: "invalid_handle" }, { status: 400 });
  }

  try {
    const existing = await db.fan.findUnique({ where: { handle } });
    if (existing && existing.id !== auth.fanId) {
      return NextResponse.json({ error: "handle_taken" }, { status: 409 });
    }
    const fan = await db.fan.update({ where: { id: auth.fanId }, data: { handle } });
    return NextResponse.json(fan);
  } catch (e: any) {
    if (e?.code === "P2002") return NextResponse.json({ error: "handle_taken" }, { status: 409 });
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
