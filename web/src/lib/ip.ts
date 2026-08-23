import { NextRequest } from "next/server";
import { createHash } from "crypto";

export function clientIp(req: NextRequest): string {
  // NOTE: behind a trusted proxy only. X-Forwarded-For is client-spoofable if the app is
  // exposed without a proxy that overwrites it — pin this to your proxy's real-IP header in prod.
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.headers.get("x-real-ip") || "local";
}

// Privacy-preserving IP fingerprint for anti-abuse counters. We never store raw IPs —
// only a salted hash, so the value can't be reversed but still groups requests by network.
export function hashIp(ip: string): string {
  const salt = process.env.ADMIN_SESSION_SECRET ?? "crownfi-dev-ip-salt";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

export function clientIpHash(req: NextRequest): string {
  return hashIp(clientIp(req));
}
