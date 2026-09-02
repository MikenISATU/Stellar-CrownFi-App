import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { signToken, verifyToken } from "@/lib/statelessToken";
import { canonicalAppOrigin } from "@/lib/appOrigin";

const COOKIE = "crownfi_admin";
const SESSION_TTL_MS = 15 * 60 * 1000;
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const SEP53_PREFIX = "Stellar Signed Message:\n";

type Challenge = { address: string; expiresAt: number };
type ChallengePayload = { a: string; e: number; i: number; o: string; r: string };
type SessionPayload = { address: string; exp: number; iat: number };

const challenges = new Map<string, Challenge>();

export function adminAllowlist(): string[] {
  return (process.env.ADMIN_WALLETS ?? process.env.NEXT_PUBLIC_ADMIN_WALLETS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isLikelyStellarAddress(address: string): boolean {
  return /^G[A-Z2-7]{55}$/.test(address);
}

export function isAdminAddress(address: string): boolean {
  return adminAllowlist().includes(address);
}

function challengeMessage(payload: ChallengePayload, nonce: string): string {
  return [
    "CrownFi admin authorization",
    `Address: ${payload.a}`,
    `Nonce: ${nonce}`,
    `Origin: ${payload.o}`,
    `Issued At: ${new Date(payload.i).toISOString()}`,
    `Expires At: ${new Date(payload.e).toISOString()}`,
  ].join("\n");
}

// Stateless nonce (HMAC token) so any serverless instance can verify — the Map is only a
// same-instance replay guard. See lib/statelessToken.ts for the rationale.
export function createAdminChallenge(address: string, req: NextRequest): { nonce: string; message: string; expiresAt: number } {
  const now = Date.now();
  const expiresAt = now + CHALLENGE_TTL_MS;
  const payload: ChallengePayload = {
    a: address,
    e: expiresAt,
    i: now,
    o: canonicalAppOrigin(req),
    r: randomBytes(8).toString("base64url"),
  };
  const nonce = signToken(payload);
  challenges.set(nonce, { address, expiresAt });

  const message = challengeMessage(payload, nonce);

  return { nonce, message, expiresAt };
}

function extractNonce(message: string): string | null {
  const match = message.match(/^Nonce: ([A-Za-z0-9_.-]+)$/m);
  return match?.[1] ?? null;
}

function sessionSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (secret) return secret;

  if (process.env.NODE_ENV === "production") {
    throw new Error("ADMIN_SESSION_SECRET is required in production");
  }

  return "dev-only-crownfi-admin-session-secret-change-before-deploy";
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

export async function verifyAdminSignature(params: {
  address: string;
  message: string;
  signature: string;
}): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const { address, message, signature } = params;
  if (!isLikelyStellarAddress(address)) return { ok: false, error: "invalid_address", status: 400 };
  if (!isAdminAddress(address)) return { ok: false, error: "not_admin", status: 403 };

  const nonce = extractNonce(message);
  if (!nonce) return { ok: false, error: "missing_nonce", status: 400 };

  const payload = verifyToken<ChallengePayload>(nonce);
  if (!payload || payload.a !== address) return { ok: false, error: "invalid_challenge", status: 401 };
  if (Date.now() > payload.e) return { ok: false, error: "challenge_expired", status: 401 };
  if (message !== challengeMessage(payload, nonce)) {
    return { ok: false, error: "challenge_message_mismatch", status: 401 };
  }

  // Same-instance: strict one-time use via the Map. Cross-instance (serverless): verify the
  // nonce's own HMAC payload instead.
  const local = challenges.get(nonce);
  challenges.delete(nonce); // one-time use, successful or not
  if (local) {
    if (local.address !== address) return { ok: false, error: "invalid_challenge", status: 401 };
    if (Date.now() > local.expiresAt) return { ok: false, error: "challenge_expired", status: 401 };
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

export function createAdminSession(address: string): string {
  const now = Date.now();
  const payload: SessionPayload = { address, iat: now, exp: now + SESSION_TTL_MS };
  const encoded = base64url(JSON.stringify(payload));
  return `v1.${encoded}.${signPayload(encoded)}`;
}

export function setAdminCookie(res: NextResponse, token: string) {
  res.cookies.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export function clearAdminCookie(res: NextResponse) {
  res.cookies.set(COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export function readAdminSession(req: NextRequest): SessionPayload | null {
  const token = req.cookies.get(COOKIE)?.value;
  if (!token) return null;

  const [version, encoded, sig] = token.split(".");
  if (version !== "v1" || !encoded || !sig) return null;
  if (!safeEqual(signPayload(encoded), sig)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SessionPayload;
    if (!payload.address || !payload.exp || Date.now() > payload.exp) return null;
    if (!isAdminAddress(payload.address)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function requireAdmin(req: NextRequest): { address: string } | NextResponse {
  const session = readAdminSession(req);
  if (!session) return NextResponse.json({ error: "admin_auth_required" }, { status: 401 });
  return { address: session.address };
}
