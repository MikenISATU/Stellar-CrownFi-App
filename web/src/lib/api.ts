// Client-side fetch helper.
//
// Why this exists: pages fetch data on mount. If the API returns a non-OK response
// (e.g. the database is not configured yet, or a transient 5xx), calling `r.json()`
// on an empty/HTML body throws "Unexpected end of JSON input" and crashes the page.
// `getJson` never throws — on any failure it resolves to the supplied fallback, so a
// page renders its empty state instead of a runtime error overlay.
//
// Caching: pass a `ttl` (ms) for data that barely changes — the roster, the round list,
// site stats. Within the window, revisiting a tab reads from memory instead of hitting the
// API again, and simultaneous callers share one request. It is OPT-IN on purpose: anything
// that must be fresh right after a transaction (balances, collectibles) simply omits `ttl`
// and always goes to the network.
type Entry = { at: number; data: unknown };
const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();

export function invalidate(urlPrefix?: string) {
  if (!urlPrefix) { cache.clear(); return; }
  for (const k of cache.keys()) if (k.startsWith(urlPrefix)) cache.delete(k);
}

export async function getJson<T>(url: string, fallback: T, opts?: { ttl?: number }): Promise<T> {
  const ttl = opts?.ttl ?? 0;

  if (ttl > 0) {
    const hit = cache.get(url);
    if (hit && Date.now() - hit.at < ttl) return hit.data as T;
    const pending = inflight.get(url);
    if (pending) return (await pending) as T; // a request for this URL is already on the wire
  }

  const run = (async () => {
    try {
      const res = await fetch(url);
      if (!res.ok) return fallback;
      const text = await res.text();
      if (!text) return fallback;
      const data = JSON.parse(text) as T;
      if (ttl > 0) cache.set(url, { at: Date.now(), data });
      return data;
    } catch {
      return fallback;
    }
  })();

  if (ttl > 0) {
    inflight.set(url, run as Promise<unknown>);
    try { return await run; } finally { inflight.delete(url); }
  }
  return run;
}

// POST helper that always resolves to a parsed body (or a typed error), never throws.
export async function postJson<T = any>(
  url: string,
  body: unknown
): Promise<{ ok: boolean; status: number; data: T | { error?: string } }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: "network_error" } };
  }
}
