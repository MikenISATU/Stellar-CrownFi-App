// Minimal fixed-window rate limiter.
// Default is in-memory so the app runs with no external services.
// In production set RATELIMIT_MODE=upstash and wire an Upstash Redis client here.

type Bucket = { count: number; resetAt: number };
const store = new Map<string, Bucket>();

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;

export function rateLimit(
  key: string,
  max: number = MAX_PER_WINDOW,
  windowMs: number = WINDOW_MS,
): { ok: boolean; remaining: number } {
  if (process.env.RATELIMIT_MODE === "upstash") {
    // Placeholder: implement Upstash REST increment with TTL here for production.
    // Falls through to in-memory if not implemented.
  }
  const now = Date.now();
  const b = store.get(key);
  if (!b || now > b.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: max - 1 };
  }
  if (b.count >= max) return { ok: false, remaining: 0 };
  b.count += 1;
  return { ok: true, remaining: max - b.count };
}
