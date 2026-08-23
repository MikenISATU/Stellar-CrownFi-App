// Tiny in-memory TTL cache for hot, read-mostly API routes.
//
// Why: every tab hits Postgres directly (~150ms per query; /api/stats runs seven of them),
// so navigation cost was dominated by repeated identical reads. Within the TTL, all callers
// share one result and concurrent callers share one in-flight promise.
//
// Scope: per server process. On Vercel that's per warm lambda — an acceptable trade for
// read-mostly data with short TTLs. Anything that must be transaction-fresh (balances,
// a fan's own votes) must NOT go through here.

type Entry = { at: number; val: unknown };
const store = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();

export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.val as T;

  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;

  const p = (async () => {
    try {
      const val = await load();
      store.set(key, { at: Date.now(), val });
      return val;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

// Call from mutation handlers so admin writes show up immediately instead of after the TTL.
export function invalidate(keyPrefix: string) {
  for (const k of store.keys()) if (k.startsWith(keyPrefix)) store.delete(k);
}
