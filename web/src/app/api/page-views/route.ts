import { NextRequest, NextResponse } from "next/server";
import { recordPageView } from "@/lib/pageViews";
import { invalidate } from "@/lib/serverCache";
import { rateLimit } from "@/lib/ratelimit";
import { clientIp } from "@/lib/ip";
import { validPublicPath } from "@/lib/predictionUpdates";

export async function POST(req: NextRequest) {
  if (!rateLimit(`page-view:${clientIp(req)}`, 120, 60_000).ok) return new NextResponse(null, { status: 429 });
  if (/bot|crawler|spider|headless/i.test(req.headers.get("user-agent") ?? "")) return new NextResponse(null, { status: 204 });
  const body = await req.json().catch(() => null);
  if (!validPublicPath(body?.path) || typeof body?.id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.id)) {
    return NextResponse.json({ error: "invalid_page_view" }, { status: 400 });
  }
  try {
    await recordPageView(body.id);
    invalidate("stats");
    return new NextResponse(null, { status: 204 });
  } catch {
    return new NextResponse(null, { status: 503 });
  }
}
