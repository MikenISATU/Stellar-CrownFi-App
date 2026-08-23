import { createHmac, timingSafeEqual } from "crypto";

// HMAC-signed, self-verifying tokens for one-shot server state (sign-in challenges,
// prepare→confirm tx intents).
//
// Why: these used to live in in-memory Maps. That breaks on serverless — on Vercel the
// "create" request and the "verify" request can land on different function instances that
// share no memory, so the verify step never finds the entry and every wallet sign-in and
// prepare→confirm purchase fails. A token that carries its own authenticated payload can be
// verified by ANY instance with the secret.
//
// Trade-off (accepted, documented): strict one-time use becomes best-effort. Callers keep a
// local Map to reject same-instance replays; across instances a token could be presented
// twice within its TTL. For sign-in that only re-issues a session to the wallet that already
// proved ownership; for tx intents the chain rejects a duplicate submission of the same
// signed transaction (sequence number already consumed).

function secret(): string {
  const s = process.env.FAN_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("FAN_SESSION_SECRET or ADMIN_SESSION_SECRET is required in production");
  }
  return "dev-only-crownfi-fan-session-secret-change-before-deploy";
}

const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64url");
const mac = (data: string) => createHmac("sha256", secret()).update(data).digest().toString("base64url");

/** Encode a JSON-serializable payload into a signed token: `<b64url(payload)>.<hmac>` */
export function signToken(payload: unknown): string {
  const body = b64url(JSON.stringify(payload));
  return `${body}.${mac(body)}`;
}

/** Verify a token's HMAC and return its payload, or null if forged/malformed. */
export function verifyToken<T>(token: string): T | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expect = mac(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expect);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}
