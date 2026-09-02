import { NextRequest } from "next/server";

function firstHeaderValue(value: string | null): string {
  return value?.split(",", 1)[0]?.trim() ?? "";
}

function normalizeConfiguredOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

// Build trusted absolute URLs from server-controlled deployment metadata. Never use the
// browser-supplied Origin header for sign-in challenge text or payment return URLs.
export function canonicalAppOrigin(req: NextRequest): string {
  const configured = normalizeConfiguredOrigin(process.env.NEXT_PUBLIC_APP_ORIGIN);
  if (configured) return configured;

  const host = firstHeaderValue(req.headers.get("x-forwarded-host")) || firstHeaderValue(req.headers.get("host"));
  const proto = firstHeaderValue(req.headers.get("x-forwarded-proto")) || (process.env.NODE_ENV === "production" ? "https" : "http");
  return `${proto}://${host || "localhost:3000"}`;
}
