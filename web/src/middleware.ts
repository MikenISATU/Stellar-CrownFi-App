import { NextRequest, NextResponse } from "next/server";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function firstHeaderValue(value: string | null): string {
  return value?.split(",", 1)[0]?.trim() ?? "";
}

function requestOrigin(req: NextRequest): string | null {
  const host = firstHeaderValue(req.headers.get("x-forwarded-host")) || firstHeaderValue(req.headers.get("host"));
  if (!host) return null;
  const proto = firstHeaderValue(req.headers.get("x-forwarded-proto")) || req.nextUrl.protocol.replace(":", "");
  return `${proto}://${host}`;
}

// Cookie-authenticated API mutations must come from this deployment. Browsers attach Origin
// and Sec-Fetch-Site automatically; server-to-server webhooks normally attach neither and are
// authenticated by their provider signature inside the route.
export function middleware(req: NextRequest) {
  if (SAFE_METHODS.has(req.method)) return NextResponse.next();

  if (req.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "cross_site_request_blocked" }, { status: 403 });
  }

  const suppliedOrigin = req.headers.get("origin");
  if (!suppliedOrigin) return NextResponse.next();

  const expectedOrigin = requestOrigin(req);
  try {
    if (!expectedOrigin || new URL(suppliedOrigin).origin !== expectedOrigin) {
      return NextResponse.json({ error: "origin_mismatch" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
