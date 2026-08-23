import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { isLikelyStellarAddress } from "@/lib/adminAuth";
import { signToken, verifyToken } from "@/lib/statelessToken";

// Fan (voter) authentication. Same shape as adminAuth, but there is no allowlist:
// any wallet that proves control of its Stellar address (SEP-53 signature) gets a
// short-lived, HMAC-signed, httpOnly session. fanId is then derived from this
// session server-side, so routes never trust a body/query fanId.

const COOKIE = "crownfi_fan";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const SEP53_PREFIX = "Stellar Signed Message:\n";

type Challenge = { address: string; expiresAt: number };
type FanSessionPayload = { fanId: string; address: string; exp: number; iat: number };

const challenges = new Map<string, Challenge>();

function appOrigin(req: NextRequest): string {
  return (
    process.env.NEXT_PUBLIC_APP_ORIGIN ||
    req.headers.get("origin") ||
    `${req.headers.get("x-forwarded-proto") ?? "http"}://${req.headers.get("host") ?? "localhost:3000"}`
  );
}

// The nonce is a stateless HMAC token carrying {address, expiry} — any server instance can
// verify it without shared memory (the old Map broke on serverless: challenge and connect
// can hit different instances). The Map below remains only as a same-instance replay guard.
export function createFanChallenge(address: string, req: NextRequest): { nonce: string; message: string; expiresAt: number } {
  const now = Date.now();
  const expiresAt = now + CHALLENGE_TTL_MS;
  const nonce = signToken({ a: address, e: expiresAt, r: randomBytes(8).toString("base64url") });
  challenges.set(nonce, { address, expiresAt });

  const message = [
    "CrownFi sign-in",
    `Address: ${address}`,
    `Nonce: ${nonce}`,
    `Origin: ${appOrigin(req)}`,
    `Issued At: ${new Date(now).toISOString()}`,
    `Expires At: ${new Date(expiresAt).toISOString()}`,
  ].join("\n");

  return { nonce, message, expiresAt };
}

function extractNonce(message: string): string | null {
  const match = message.match(/^Nonce: ([A-Za-z0-9_.-]+)$/m);
  return match?.[1] ?? null;
}

function sessionSecret(): string {
  const secret = process.env.FAN_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("FAN_SESSION_SECRET or ADMIN_SESSION_SECRET is required in production");
  }
  return "dev-only-crownfi-fan-session-secret-change-before-deploy";
}

function base64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}
function signPayload(payload: string): string {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
function sep53Hash(message: string): Buffer {
  return createHash("sha256").update(SEP53_PREFIX).update(Buffer.from(message, "utf8")).digest();
}

export async function verifyFanSignature(params: {
  address: string;
  message: string;
  signature: string;
}): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const { address, message, signature } = params;
  if (!isLikelyStellarAddress(address)) return { ok: false, error: "invalid_address", status: 400 };

  const nonce = extractNonce(message);
  if (!nonce) return { ok: false, error: "missing_nonce", status: 400 };

  // Same-instance path: consume from the Map (strict one-time use). Cross-instance path
  // (serverless): fall back to verifying the nonce's own HMAC payload.
  const local = challenges.get(nonce);
  challenges.delete(nonce);
  if (local) {
    if (local.address !== address) return { ok: false, error: "invalid_challenge", status: 401 };
    if (Date.now() > local.expiresAt) return { ok: false, error: "challenge_expired", status: 401 };
  } else {
    const payload = verifyToken<{ a: string; e: number }>(nonce);
    if (!payload || payload.a !== address) return { ok: false, error: "invalid_challenge", status: 401 };
    if (Date.now() > payload.e) return { ok: false, error: "challenge_expired", status: 401 };
  }

  try {
    const sdk: any = await import("@stellar/stellar-sdk");
    const keypair = sdk.Keypair.fromPublicKey(address);
    const valid = keypair.verify(sep53Hash(message), Buffer.from(signature, "base64"));
    if (!valid) return { ok: false, error: "bad_signature", status: 401 };
    return { ok: true };
  } catch {
    return { ok: false, error: "signature_verify_failed", status: 400 };
  }
}

export function createFanSession(fanId: string, address: string): string {
  const now = Date.now();
  const payload: FanSessionPayload = { fanId, address, iat: now, exp: now + SESSION_TTL_MS };
  const encoded = base64url(JSON.stringify(payload));
  return `v1.${encoded}.${signPayload(encoded)}`;
}

export function setFanCookie(res: NextResponse, token: string) {
  res.cookies.set(COOKIE, token, {
    httpOnly: true,
    // "lax" (not "strict") so the session cookie is still sent when the app is opened in a new
    // tab or reached via a top-level navigation — "strict" made the app look logged-out there.
    // Mutations are same-origin POSTs, which lax still covers, so CSRF posture is unchanged.
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export function clearFanCookie(res: NextResponse) {
  res.cookies.set(COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export function readFanSession(req: NextRequest): { fanId: string; address: string } | null {
  const token = req.cookies.get(COOKIE)?.value;
  if (!token) return null;

  const [version, encoded, sig] = token.split(".");
  if (version !== "v1" || !encoded || !sig) return null;
  if (!safeEqual(signPayload(encoded), sig)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as FanSessionPayload;
    if (!payload.fanId || !payload.address || !payload.exp || Date.now() > payload.exp) return null;
    return { fanId: payload.fanId, address: payload.address };
  } catch {
    return null;
  }
}

export function requireFan(req: NextRequest): { fanId: string; address: string } | NextResponse {
  const session = readFanSession(req);
  if (!session) return NextResponse.json({ error: "fan_auth_required" }, { status: 401 });
  return session;
}
