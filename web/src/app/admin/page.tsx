"use client";
import { useEffect, useState } from "react";
import { Icons } from "@/components/icons";
import { useSession } from "@/session/SessionProvider";
import { short } from "@/lib/format";
import { Flag } from "@/components/Flag";
import { Toast } from "@/components/ui";
import { getJson, postJson } from "@/lib/api";
import { signAdminMessage, signWithFreighter } from "@/wallet/freighter";
import { STATUS_LABEL, STATUS_CHIP } from "@/lib/pageant";
import { messageFor } from "@/lib/messages";
import { BannerUpload } from "@/components/BannerUpload";
import { MarketCloseField } from "@/components/MarketCloseField";
import { MarketOutcomesField } from "@/components/MarketOutcomesField";
import { PAGEANT_SEGMENTS, MARKET_CATEGORIES, CATEGORY_LABEL } from "@/lib/segments";

type Tab = "overview" | "rounds" | "contestants" | "requests" | "pageants" | "payments" | "markets";

export default function AdminPage() {
  const { isAdmin, address, connect, connecting } = useSession();
  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<any>(null);
  const [rounds, setRounds] = useState<any[]>([]);
  const [contestants, setContestants] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [requestsLocked, setRequestsLocked] = useState(false);
  const [pageants, setPageants] = useState<any[]>([]);
  const [pageantsLocked, setPageantsLocked] = useState(false);
  const [reviewing, setReviewing] = useState<any | null>(null);
  const [reviewingRequest, setReviewingRequest] = useState<any | null>(null);
  const [settings, setSettings] = useState<any | null>(null);
  const [settingsLocked, setSettingsLocked] = useState(false);
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState({ msg: "", tone: "ok" as "ok" | "err" });

  async function loadSettings() {
    try {
      const res = await fetch("/api/admin/settings");
      if (res.status === 401) { setSettingsLocked(true); return; }
      if (res.ok) { setSettings(await res.json()); setSettingsLocked(false); }
    } catch { /* ignore */ }
  }
  async function unlockSettings() {
    if (await ensureAdminSession()) { setSettingsLocked(false); loadSettings(); }
  }
  async function saveSettings(patch: any) {
    if (!(await ensureAdminSession())) return;
    const r = await fetch("/api/admin/settings", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(patch) });
    if (r.ok) { flash("Settings saved"); loadSettings(); } else flash("Could not save settings", "err");
  }

  const [markets, setMarkets] = useState<any[]>([]);
  async function loadMarkets() { getJson<any[]>("/api/markets", []).then(setMarkets); }
  async function createMarket(body: any) {
    if (!(await ensureAdminSession())) return;
    const r = await fetch("/api/markets", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (r.ok) { flash("Market created"); loadMarkets(); } else { const d = await r.json().catch(() => ({})); flash(messageFor(d.error, "Could not create market."), "err"); }
  }
  async function resolveMarket(id: string, action: string, winningOption?: number) {
    if (!(await ensureAdminSession())) return;
    const r = await fetch(`/api/markets/${id}/resolve`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, winningOption }) });
    if (r.ok) { flash(`Market ${action}d`); loadMarkets(); } else { const d = await r.json().catch(() => ({})); flash(messageFor(d.error, "Could not update market."), "err"); }
  }
  async function deleteMarket(id: string, force = false): Promise<boolean> {
    if (!(await ensureAdminSession())) return false;
    const r = await fetch(`/api/markets/${id}${force ? "?force=1" : ""}`, { method: "DELETE" });
    const d = await r.json().catch(() => ({}));
    if (r.ok) {
      flash(d.autoRefunded > 0 ? `Market deleted — ${d.autoRefunded} wallet refund${d.autoRefunded === 1 ? "" : "s"} sent automatically.` : "Market deleted");
      loadMarkets();
      return true;
    }
    flash(messageFor(d.error, "Could not delete market."), "err");
    loadMarkets();
    // A legacy market with positions is intentionally retained after cancellation so
    // users can authorize their refunds. The requested destructive action is safely queued.
    return Boolean(d.cancelled);
  }

  function loadAll() {
    getJson("/api/stats", null).then(setStats);
    getJson<any[]>("/api/rounds", []).then(setRounds);
    getJson<any[]>("/api/contestants", []).then(setContestants);
    loadRequests();
    loadPageants();
    loadSettings();
    loadMarkets();
  }
  // Pageant submissions are admin-only (same unlock pattern as organizer requests).
  async function loadPageants() {
    try {
      const res = await fetch("/api/pageants?all=1");
      if (res.status === 401) { setPageantsLocked(true); return; }
      if (res.ok) { setPageants(await res.json()); setPageantsLocked(false); }
    } catch { /* ignore */ }
  }
  async function unlockPageants() {
    if (await ensureAdminSession()) { setPageantsLocked(false); loadPageants(); }
  }
  async function openReview(id: string) {
    const r = await fetch(`/api/pageants/${id}`);
    if (r.ok) setReviewing(await r.json());
    else flash("Could not load submission.", "err");
  }
  async function decide(id: string, decision: string, note?: string) {
    if (!(await ensureAdminSession())) return;
    const r = await fetch(`/api/pageants/${id}/review`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ decision, note }) });
    if (r.ok) { flash(`Marked ${decision.replace("_", " ")}`); setReviewing(null); loadPageants(); }
    else { const d = await r.json().catch(() => ({})); flash(d.error === "note_required" ? "Add a note explaining the requested changes." : messageFor(d.error, "Could not update."), "err"); }
  }
  // Organizer requests are admin-only (they hold contact details). If we don't yet have a
  // verified admin session the GET returns 401 — surface an unlock prompt instead of a silent empty list.
  async function loadRequests() {
    try {
      const res = await fetch("/api/organizer-requests");
      if (res.status === 401) { setRequestsLocked(true); return; }
      if (res.ok) { setRequests(await res.json()); setRequestsLocked(false); }
    } catch { /* ignore transient errors */ }
  }
  async function unlockRequests() {
    if (await ensureAdminSession()) { setRequestsLocked(false); loadRequests(); }
  }
  useEffect(() => { if (isAdmin) loadAll(); }, [isAdmin]);

  function flash(msg: string, tone: "ok" | "err" = "ok") { setToast({ msg, tone }); setTimeout(() => setToast({ msg: "", tone }), 2600); }

  async function ensureAdminSession(): Promise<boolean> {
    if (!address) { flash("Connect your admin wallet first.", "err"); return false; }

    const challenge = await postJson<any>("/api/admin/challenge", { address });
    if (!challenge.ok) { flash("Admin wallet is not authorized server-side.", "err"); return false; }

    const signed = await signAdminMessage((challenge.data as any).message, address);
    if (signed.error || !signed.signature) { flash(signed.error ?? "Admin signature was cancelled.", "err"); return false; }

    const verified = await postJson<any>("/api/admin/verify", {
      address,
      message: (challenge.data as any).message,
      signature: signed.signature,
    });
    if (!verified.ok) { flash("Could not verify admin signature.", "err"); return false; }
    return true;
  }


  async function closeRound(id: string) {
    if (!(await ensureAdminSession())) return;
    setBusy(id);
    try {
      // Step 1 — compute the tally + build the anchor tx.
      const prep = await postJson<any>(`/api/rounds/${id}/prepare-close`, { adminAddress: address! });
      if (!prep.ok) throw new Error((prep.data as any)?.error ?? "prepare_failed");

      if ((prep.data as any).mock) {
        const r = await postJson<any>(`/api/rounds/${id}/close`, {});
        if (!r.ok) throw new Error((r.data as any)?.error ?? "close_failed");
        flash(`Round anchored (mock). Root ${short((r.data as any).merkleRoot, 6)}`, "ok");
        return;
      }

      // Step 2 — admin signs the anchor in Freighter.
      const signed = await signWithFreighter((prep.data as any).xdr, address!);
      if (signed.error || !signed.signedXdr) throw new Error(signed.error ?? "You cancelled the signature.");

      // Step 3 — submit + persist.
      const conf = await postJson<any>(`/api/rounds/${id}/confirm-close`, { signedXdr: signed.signedXdr, intentId: (prep.data as any).intentId });
      if (!conf.ok) throw new Error((conf.data as any)?.error ?? "confirm_failed");

      flash(`Anchored on Stellar ✓ Root ${short((conf.data as any).merkleRoot, 6)}`, "ok");
    } catch (e: any) {
      const m = String(e?.message ?? "");
      flash(
        m.includes("already published") ? "This round is already anchored on-chain."
          : m.includes("auth") || m.includes("require") ? "Connect the wallet that is the audit-anchor admin (alice)."
          : `Could not anchor: ${m}`,
        "err"
      );
    } finally {
      setBusy(""); loadAll();
    }
  }
  async function createRound(title: string, category: string) {
    if (!(await ensureAdminSession())) return;
    const res = await fetch("/api/rounds", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title, category }) });
    if (res.ok) { loadAll(); flash("Round created"); } else flash("Could not create round", "err");
  }
  async function createContestant(body: any) {
    if (!(await ensureAdminSession())) return;
    const res = await fetch("/api/contestants", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    if (res.ok) { loadAll(); flash("Contestant added"); } else flash(data.error ?? "Error", "err");
  }
  async function decideRequest(id: string, status: string) {
    if (!(await ensureAdminSession())) return;
    const res = await fetch("/api/organizer-requests", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, status }) });
    if (res.ok) { loadAll(); flash(status === "approved" ? "Organizer approved" : "Request rejected"); } else flash("Error", "err");
  }

  if (!isAdmin) {
    return (
      <div className="glass mx-auto max-w-md p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full surface-soft text-[#a97f16]"><Icons.Lock size={22} strokeWidth={1.75} /></div>
        <h1 className="mt-3 tracking-tight text-2xl text-[#23252f]">Admin area</h1>
        <p className="mt-2 text-sm text-[#5f6172]">Connect an allowlisted admin wallet to manage rounds, contestants, and anchoring.</p>
        <button className="btn-gold mt-4" onClick={() => connect()}>{connecting ? "Connecting..." : "Connect admin wallet"}</button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="eyebrow mb-2">Organizer console</div>
          <h1 className="tracking-tight text-4xl font-semibold text-[#23252f]">Admin</h1>
        </div>
        <div className="flex gap-1 rounded-full border border-[#e7e2d3] bg-[#faf7ef] p-1">
          {(["overview", "rounds", "contestants", "requests", "pageants", "payments", "markets"] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`rounded-full px-4 py-1.5 text-sm capitalize transition ${tab === t ? "bg-gold text-ink" : "text-[#3a3f52] hover:text-[#23252f]"}`}>{t}</button>
          ))}
        </div>
      </div>

      {tab === "overview" && <Overview stats={stats} />}
      {tab === "rounds" && <Rounds rounds={rounds} contestants={contestants} busy={busy} onClose={closeRound} onCreate={createRound} />}
      {tab === "contestants" && <Contestants contestants={contestants} onCreate={createContestant} />}
      {tab === "requests" && <Requests requests={requests} locked={requestsLocked} onUnlock={unlockRequests} onReview={setReviewingRequest} />}
      {reviewingRequest && <RequestModal req={reviewingRequest} onClose={() => setReviewingRequest(null)} onDecide={(id: string, status: string) => { decideRequest(id, status); setReviewingRequest(null); }} />}
      {tab === "pageants" && <Pageants pageants={pageants} locked={pageantsLocked} onUnlock={unlockPageants} onReview={openReview} />}
      {tab === "payments" && <Payments data={settings} locked={settingsLocked} onUnlock={unlockSettings} onSave={saveSettings} />}
      {tab === "markets" && <Markets markets={markets} onCreate={createMarket} onResolve={resolveMarket} onDelete={deleteMarket} />}

      {reviewing && <ReviewModal pageant={reviewing} onClose={() => setReviewing(null)} onDecide={decide} />}

      <Toast msg={toast.msg} tone={toast.tone} />
    </div>
  );
}

function Overview({ stats }: { stats: any }) {
  const cards = [
    { label: "Votes cast", v: stats?.votes ?? 0 },
    { label: "Tickets minted", v: stats?.tickets ?? 0 },
    { label: "Collectibles sold", v: stats?.collectiblesSold ?? 0 },
    { label: "Contestants", v: stats?.contestants ?? 0 },
    { label: "Rounds", v: stats?.rounds ?? 0 },
    { label: "GMV (USDC)", v: stats?.gmv ?? 0 },
  ];
  const top = stats?.topContestants ?? [];
  const max = Math.max(1, ...top.map((t: any) => t.votes));
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <div key={c.label} className="glass p-4">
            <div className="font-display text-3xl font-semibold text-[#b8912f]">{c.v.toLocaleString?.() ?? c.v}</div>
            <div className="mt-1 text-[11px] uppercase tracking-wider text-[#7a7768]">{c.label}</div>
          </div>
        ))}
      </div>
      <div className="glass p-5">
        <h2 className="mb-4 tracking-tight text-xl text-[#23252f]">Vote leaderboard</h2>
        {top.length === 0 ? <p className="text-sm text-[#7a7768]">No votes yet.</p> : (
          <div className="space-y-3">
            {top.map((t: any) => (
              <div key={t.name} className="flex items-center gap-3">
                <div className="flex w-40 shrink-0 items-center gap-1.5 truncate text-sm text-[#23252f]/80"><Flag sash={t.sash} /> {t.name}</div>
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-[#f1ecdf]">
                  <div className="h-full rounded-full bg-gradient-to-r from-gold-deep to-gold" style={{ width: `${(t.votes / max) * 100}%` }} />
                </div>
                <div className="w-10 shrink-0 text-right text-sm font-semibold text-[#b8912f]">{t.votes}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Rounds({ rounds, contestants, busy, onClose, onCreate }: any) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(PAGEANT_SEGMENTS[0].key as string);
  return (
    <div className="space-y-4">
      <div className="glass flex flex-col gap-3 p-4 sm:flex-row">
        <select className="field sm:w-56" value={category} onChange={(e) => setCategory(e.target.value)}>
          {PAGEANT_SEGMENTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <input className="field" placeholder="Round title (e.g. Grand Finals)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <button className="btn-gold shrink-0" disabled={!title} onClick={() => { onCreate(title, category); setTitle(""); }}>Create round</button>
      </div>
      {rounds.map((r: any) => (
        <div key={r.id} className="glass p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="font-display text-lg text-[#23252f]">{r.title}</div>
                {r.category && <span className="rounded-full bg-[#faf0d2] px-2 py-0.5 text-[11px] font-semibold text-[#8a6d1f]">{CATEGORY_LABEL[r.category] ?? r.category}</span>}
              </div>
              <div className="text-xs text-[#7a7768]">
                <span className={r.status === "open" ? "text-emerald" : "text-[#7a7768]"}>{r.status}</span> · {r._count?.votes ?? 0} votes
                {r.checkpoint && <span className="mono ml-2 text-emerald">root {short(r.checkpoint.merkleRoot, 6)}</span>}
              </div>
            </div>
            <button className="btn-gold" disabled={r.status === "closed" || busy === r.id} onClick={() => onClose(r.id)}>
              {busy === r.id ? "Anchoring..." : r.status === "closed" ? "Anchored" : "Close + anchor"}
            </button>
          </div>
          {r.status === "closed" && <AnchorPanel roundId={r.id} contestants={contestants} />}
        </div>
      ))}
    </div>
  );
}

// Admin view of a closed round: the sealed results + the on-chain anchor that locks them.
// This is the flip side of the fan-facing Verify tab — fans prove THEIR vote is in the
// sealed count; the admin sees the whole sealed count and the transaction that sealed it.
function AnchorPanel({ roundId, contestants }: { roundId: string; contestants: any[] }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<any>(null);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !data) {
      const r = await fetch(`/api/rounds/${roundId}/results`);
      if (r.ok) setData(await r.json());
    }
  }

  const nameOf = (id: string) => contestants.find((c: any) => c.id === id)?.name ?? short(id, 4);
  const cp = data?.checkpoint;
  const tally = cp ? [...cp.tally].sort((a: any, b: any) => b.votes - a.votes) : [];
  const maxVotes = Math.max(1, ...tally.map((t: any) => t.votes));

  return (
    <div className="mt-3 border-t border-[#eee6d3] pt-3">
      <button onClick={toggle} className="flex items-center gap-2 text-sm font-semibold text-[#a97f16] hover:underline">
        <Icons.ChevronDown size={14} strokeWidth={2} className={`transition-transform ${open ? "rotate-180" : ""}`} />
        {open ? "Hide sealed results" : "View sealed results & anchor"}
      </button>

      {open && !data && <div className="mt-3 text-xs text-[#7a7768]">Loading…</div>}

      {open && data && !cp && (
        <div className="mt-3 text-xs text-[#9a5a12]">Closed, but no checkpoint found — this round was closed before anchoring existed.</div>
      )}

      {open && cp && (
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          {/* The seal */}
          <div className="rounded-xl surface-soft p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#0f6e56]">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-[#e6f6ef]"><Icons.Check size={12} strokeWidth={3} /></span>
              Sealed on Stellar — results can no longer be altered
            </div>
            <div className="mt-3 space-y-2 text-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[#7a7768]">Anchor transaction</span>
                {cp.anchorTx ? (
                  <a href={`https://stellar.expert/explorer/testnet/tx/${cp.anchorTx}`} target="_blank" rel="noopener noreferrer" className="mono text-[#a97f16] hover:underline">
                    {short(cp.anchorTx, 8)} ↗
                  </a>
                ) : <span className="text-[#9a968b]">—</span>}
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[#7a7768]">Merkle root</span>
                <span className="mono text-[#23252f]">{short(cp.merkleRoot, 8)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[#7a7768]">Votes sealed</span>
                <span className="font-semibold tabular-nums text-[#23252f]">{cp.totalVotes}</span>
              </div>
              {data.round?.closedAt && (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[#7a7768]">Closed at</span>
                  <span className="text-[#23252f]">{new Date(data.round.closedAt).toLocaleString()}</span>
                </div>
              )}
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-[#7a7768]">
              Fans verify against this same root on the Verify tab — a green check there means their
              vote is inside this sealed count.
            </p>
          </div>

          {/* The sealed tally */}
          <div className="rounded-xl surface-soft p-4">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#7a7768]">Sealed results</div>
            {tally.length === 0 && <div className="text-xs text-[#9a968b]">No votes were cast in this round.</div>}
            <div className="space-y-2">
              {tally.map((t: any, i: number) => (
                <div key={t.contestantId} className="flex items-center gap-2 text-sm">
                  <span className={`w-5 text-right font-display ${i === 0 ? "text-[#b8912f]" : "text-[#9a968b]"}`}>{i + 1}</span>
                  <span className={`min-w-0 flex-1 truncate ${i === 0 ? "font-semibold text-[#23252f]" : "text-[#5f6172]"}`}>{t.name ?? nameOf(t.contestantId)}</span>
                  <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[#efe9d8]">
                    <div className="h-full rounded-full bg-gradient-to-r from-[#d4af37] to-[#b8912f]" style={{ width: `${Math.round((t.votes / maxVotes) * 100)}%` }} />
                  </div>
                  <span className="w-8 text-right font-semibold tabular-nums text-[#b8912f]">{t.votes}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Contestants({ contestants, onCreate }: any) {
  const [f, setF] = useState({ name: "", country: "", sash: "" });
  return (
    <div className="space-y-4">
      <div className="glass grid gap-3 p-4 sm:grid-cols-[1fr_1fr_auto_auto]">
        <input className="field" placeholder="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <input className="field" placeholder="Country" value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })} />
        <input className="field sm:w-24" placeholder="Sash (PH)" maxLength={2} value={f.sash} onChange={(e) => setF({ ...f, sash: e.target.value.toUpperCase() })} />
        <button className="btn-gold shrink-0" disabled={!f.name || !f.country || f.sash.length !== 2} onClick={() => { onCreate(f); setF({ name: "", country: "", sash: "" }); }}>Add</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {contestants.map((c: any) => (
          <div key={c.id} className="glass flex items-center gap-3 p-4">
            <Flag sash={c.sash} className="!h-5 !w-7" />
            <div>
              <div className="font-medium text-[#23252f]">{c.name}</div>
              <div className="text-xs text-[#7a7768]">{c.country} · {c.sash}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const REQ_STATUS_CHIP: Record<string, string> = { pending: "bg-[#faf0d2] text-[#8a6d1f]", approved: "bg-[#e1f5ee] text-[#0f6e56]", rejected: "bg-[#fbe9ef] text-[#9f1239]" };

function Requests({ requests, onReview, locked, onUnlock }: any) {
  if (locked) {
    return (
      <div className="glass p-8 text-center">
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full surface-soft text-[#a97f16]"><Icons.Lock size={22} strokeWidth={1.75} /></div>
        <div className="font-display text-xl text-[#23252f]">Verify to view organizer requests</div>
        <p className="mx-auto mt-1 max-w-md text-sm text-[#7a7768]">Organizer applications include contact details, so viewing them requires a one-time admin wallet signature.</p>
        <button className="btn-gold mt-4" onClick={onUnlock}>Verify admin wallet</button>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {requests.length === 0 && <div className="glass p-6 text-center text-[#7a7768]">No organizer requests yet.</div>}
      {requests.map((r: any) => (
        <div key={r.id} className="glass flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="font-display text-lg text-[#23252f]">{r.pageantName}</div>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${REQ_STATUS_CHIP[r.status] ?? ""}`}>{r.status}</span>
            </div>
            <div className="text-xs text-[#7a7768]">{r.orgName} · {r.country} · {r.contactName} ({r.email})</div>
          </div>
          <button className="btn-gold !px-4 !py-1.5" onClick={() => onReview(r)}>Review</button>
        </div>
      ))}
    </div>
  );
}

function RequestModal({ req, onClose, onDecide }: { req: any; onClose: () => void; onDecide: (id: string, status: string) => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 max-h-[90vh] w-full max-w-xl overflow-y-auto glass p-6">
        <div className="mb-4 flex items-start justify-between gap-3 border-b border-[#eee6d3] pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="tracking-tight text-2xl font-semibold text-[#23252f]">{req.pageantName}</h3>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${REQ_STATUS_CHIP[req.status] ?? ""}`}>{req.status}</span>
            </div>
            <div className="mt-1 text-sm text-[#7a7768]">{req.orgName}</div>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-[#7a7768] hover:bg-[#faf7ef]"><Icons.X size={18} /></button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Info label="Contact person" value={req.contactName} />
          <Info label="Email" value={req.email} />
          <Info label="Country" value={req.country} />
          <Info label="Submitted" value={new Date(req.createdAt).toLocaleString()} />
        </div>
        {req.message && (
          <div className="mt-3">
            <div className="text-[10px] uppercase tracking-wider text-[#7a7768]">Message</div>
            <p className="mt-1 rounded-lg surface-soft px-3 py-2 text-sm text-[#3a3f52]">{req.message}</p>
          </div>
        )}

        <div className="mt-5 border-t border-[#eee6d3] pt-4">
          {req.status === "pending" ? (
            <div className="flex flex-wrap justify-end gap-2">
              <button className="btn-ghost !px-4 !py-2 !text-[#9f1239]" onClick={() => onDecide(req.id, "rejected")}>Reject</button>
              <button className="btn-gold !px-5 !py-2" onClick={() => onDecide(req.id, "approved")}>Approve</button>
            </div>
          ) : (
            <div className="text-sm text-[#7a7768]">This request is <b className="capitalize">{req.status}</b> — no action available.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function Pageants({ pageants, locked, onUnlock, onReview }: any) {
  if (locked) {
    return (
      <div className="glass p-8 text-center">
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full surface-soft text-[#a97f16]"><Icons.Lock size={22} strokeWidth={1.75} /></div>
        <div className="font-display text-xl text-[#23252f]">Verify to review pageant submissions</div>
        <p className="mx-auto mt-1 max-w-md text-sm text-[#7a7768]">Submissions include organizer contact details, so viewing them requires a one-time admin wallet signature.</p>
        <button className="btn-gold mt-4" onClick={onUnlock}>Verify admin wallet</button>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {pageants.length === 0 && <div className="glass p-6 text-center text-[#7a7768]">No pageant submissions yet.</div>}
      {pageants.map((p: any) => (
        <div key={p.id} className="glass flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="font-display text-lg text-[#23252f]">{p.title}</div>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_CHIP[p.status]}`}>{STATUS_LABEL[p.status]}</span>
            </div>
            <div className="text-xs text-[#7a7768]">
              {p.orgName} · {p.contactName} ({p.email}) · {p._count?.candidates ?? 0} candidates ·{" "}
              <span className={p.driveUrl ? "text-[#3f7d4e]" : "text-[#9a5a12]"}>{p.driveUrl ? "files linked" : "no files"}</span>
            </div>
          </div>
          <button className="btn-gold !px-4 !py-1.5" onClick={() => onReview(p.id)}>Review</button>
        </div>
      ))}
    </div>
  );
}

function ReviewModal({ pageant, onClose, onDecide }: { pageant: any; onClose: () => void; onDecide: (id: string, decision: string, note?: string) => void }) {
  const [note, setNote] = useState("");
  const actionable = pageant.status === "submitted" || pageant.status === "in_review";
  const links = [
    ["Website", pageant.website], ["Facebook", pageant.facebook], ["Instagram", pageant.instagram],
    ["Other", pageant.socials], ["Verification", pageant.verification],
  ].filter(([, v]) => v);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 max-h-[90vh] w-full max-w-3xl overflow-y-auto glass p-6">
        <div className="mb-4 flex items-start justify-between gap-3 border-b border-[#eee6d3] pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="tracking-tight text-2xl font-semibold text-[#23252f]">{pageant.title}</h3>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_CHIP[pageant.status]}`}>{STATUS_LABEL[pageant.status]}</span>
            </div>
            <div className="mt-1 text-sm text-[#7a7768]">{pageant.orgName}</div>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-[#7a7768] hover:bg-[#faf7ef]"><Icons.X size={18} /></button>
        </div>

        {/* Required files — the organizer's Drive folder */}
        <div className={`mb-4 rounded-xl border p-3 ${pageant.driveUrl ? "border-[#efe4c2] bg-[#faf7ef]" : "border-[#f0d9a0] bg-[#fff8e6]"}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[#7a7768]">Required files</div>
              <div className="text-sm text-[#23252f]">
                {pageant.driveUrl ? "Google Drive folder submitted by the organizer" : "No Drive folder linked — ask for permits, roster and hi-res photos."}
              </div>
            </div>
            {pageant.driveUrl && (
              <a href={pageant.driveUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost !px-4 !py-2 shrink-0">Open Drive folder ↗</a>
            )}
          </div>
          {pageant.driveUrl && <div className="mt-2 break-all text-xs text-[#7a7768]">{pageant.driveUrl}</div>}
        </div>

        {/* Organizer + event info */}
        <div className="grid gap-3 sm:grid-cols-2">
          <Info label="Contact" value={`${pageant.contactName} · ${pageant.email}`} />
          <Info label="Organization" value={pageant.orgName} />
          <Info label="Venue" value={pageant.venue ?? "—"} />
          <Info label="Event date" value={pageant.eventDate ? new Date(pageant.eventDate).toLocaleDateString() : "—"} />
          <Info label="Candidates" value={String(pageant.candidates?.length ?? 0)} />
          <Info label="Submitted" value={pageant.createdAt ? new Date(pageant.createdAt).toLocaleDateString() : "—"} />
        </div>
        {pageant.description && <p className="mt-3 rounded-lg surface-soft px-3 py-2 text-sm text-[#3a3f52]">{pageant.description}</p>}

        {links.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {links.map(([label, url]: any) => (
              <a key={label} href={url} target="_blank" rel="noopener noreferrer" className="chip hover:border-[#c9a227]">{label} ↗</a>
            ))}
          </div>
        )}

        {/* Candidates + images (click a photo to open it full size) */}
        <h4 className="mt-5 mb-2 font-display text-lg text-[#23252f]">Candidates</h4>
        <div className="space-y-3">
          {(pageant.candidates ?? []).map((c: any) => (
            <div key={c.id} className="rounded-xl border border-[#eee6d3] p-3">
              <div className="text-sm font-semibold text-[#23252f]">
                {c.number != null && <span className="mr-1.5 text-[#a97f16]">#{c.number}</span>}
                {c.fullName}{" "}
                <span className="text-xs font-normal text-[#7a7768]">· {c.location ?? "—"} · supply {c.maxSupply}</span>
              </div>
              {c.bio && <p className="mt-1 text-xs leading-relaxed text-[#5f6172]">{c.bio}</p>}
              <div className="mt-2 flex flex-wrap gap-3">
                {(c.images ?? []).length === 0 && <span className="text-xs text-[#9a968b]">No images uploaded</span>}
                {(c.images ?? []).map((img: any) => (
                  <a key={img.categoryKey} href={img.url} target="_blank" rel="noopener noreferrer" className="group" title="Open full size">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt={img.categoryKey} className="h-20 w-20 rounded-lg object-cover ring-1 ring-[#eee6d3] transition group-hover:ring-[#c9a227]" />
                    <div className="mt-1 text-center text-[10px] uppercase tracking-wider text-[#7a7768]">{img.categoryKey.replace("_", " ")}</div>
                  </a>
                ))}
              </div>
            </div>
          ))}
          {(pageant.candidates ?? []).length === 0 && <div className="text-sm text-[#7a7768]">No candidates.</div>}
        </div>

        {/* Decisions */}
        {actionable ? (
          <div className="mt-5 border-t border-[#eee6d3] pt-4">
            <textarea className="field min-h-16" placeholder="Note (required to request changes / reject)" value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              {pageant.status === "submitted" && <button className="btn-ghost !px-4 !py-2" onClick={() => onDecide(pageant.id, "in_review")}>Mark in review</button>}
              <button className="btn-ghost !px-4 !py-2" onClick={() => onDecide(pageant.id, "requires_changes", note)}>Request changes</button>
              <button className="btn-ghost !px-4 !py-2 !text-[#9f1239]" onClick={() => onDecide(pageant.id, "rejected", note)}>Reject</button>
              <button className="btn-gold !px-5 !py-2" onClick={() => onDecide(pageant.id, "approved")}>Approve & publish</button>
            </div>
          </div>
        ) : (
          <div className="mt-5 border-t border-[#eee6d3] pt-4 text-sm text-[#7a7768]">This submission is <b>{STATUS_LABEL[pageant.status]}</b> — no action available.</div>
        )}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg surface-soft px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-[#7a7768]">{label}</div>
      <div className="text-sm text-[#23252f]">{value}</div>
    </div>
  );
}

function Toggle({ label, hint, checked, disabled, onChange }: { label: string; hint?: string; checked: boolean; disabled?: boolean; onChange: () => void }) {
  return (
    <button type="button" onClick={() => !disabled && onChange()} disabled={disabled} className={`flex w-full items-center justify-between gap-4 rounded-xl surface-soft px-4 py-3 text-left ${disabled ? "opacity-50" : "hover:bg-[#f5efe0]"}`}>
      <span>
        <span className="block text-sm font-medium text-[#23252f]">{label}</span>
        {hint && <span className="block text-xs text-[#7a7768]">{hint}</span>}
      </span>
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-gradient-to-b from-[#d4af37] to-[#b8912f]" : "bg-[#d9d3c3]"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${checked ? "left-[22px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}

function Payments({ data, locked, onUnlock, onSave }: any) {
  // Hooks must run unconditionally (before any early return).
  const [form, setForm] = useState<any>(data?.settings ?? {});
  useEffect(() => { if (data?.settings) setForm(data.settings); }, [data?.settings]);

  if (locked) {
    return (
      <div className="glass p-8 text-center">
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full surface-soft text-[#a97f16]"><Icons.Lock size={22} strokeWidth={1.75} /></div>
        <div className="font-display text-xl text-[#23252f]">Verify to manage payment settings</div>
        <button className="btn-gold mt-4" onClick={onUnlock}>Verify admin wallet</button>
      </div>
    );
  }
  if (!data) return <div className="glass p-6 text-center text-[#7a7768]">Loading settings…</div>;

  const providers = data.providers ?? [];
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const toggle = (k: string) => setForm((f: any) => ({ ...f, [k]: !f[k] }));
  const selected = providers.find((p: any) => p.id === form.activeProvider);

  return (
    <div className="space-y-6">
      <div className="glass space-y-4 p-5">
        <h2 className="tracking-tight text-xl text-[#23252f]">Payment & KYC settings</h2>
        <Toggle label="Payments enabled" hint="Master switch for all paid actions" checked={form.paymentsEnabled} onChange={() => toggle("paymentsEnabled")} />
        <Toggle label="KYC verification enabled" hint="Turn on identity verification for paid actions" checked={form.kycEnabled} onChange={() => toggle("kycEnabled")} />
        <Toggle label="KYC mandatory" hint="Require KYC (vs optional prompt) for paid actions" checked={form.kycMandatory} disabled={!form.kycEnabled} onChange={() => toggle("kycMandatory")} />
        <Toggle label="Maintenance mode" hint="Temporarily pause the platform for users" checked={form.maintenanceMode} onChange={() => toggle("maintenanceMode")} />
        <Toggle label="Announce winners" hint="Reveals the Winners page to everyone — flip at the coronation moment. Results stay sealed on-chain either way." checked={form.winnersAnnounced} onChange={() => toggle("winnersAnnounced")} />

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm"><div className="mb-1 text-[#5f6172]">Environment</div>
            <select className="field" value={form.environment} onChange={(e) => set("environment", e.target.value)}>
              <option value="testnet">Testnet</option>
              <option value="production">Production</option>
            </select>
          </label>
          <label className="text-sm"><div className="mb-1 text-[#5f6172]">Active payment provider</div>
            <select className="field" value={form.activeProvider} onChange={(e) => set("activeProvider", e.target.value)}>
              {providers.map((p: any) => <option key={p.id} value={p.id}>{p.label}{p.implemented ? "" : " (not wired)"}</option>)}
            </select>
          </label>
        </div>

        {selected && (
          <div className="rounded-xl surface-soft px-4 py-3 text-xs text-[#5f6172]">
            <div className="mb-1 font-semibold text-[#23252f]">{selected.label} — capabilities</div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(selected.capabilities).map(([k, v]) => (
                <span key={k} className={`rounded-full px-2 py-0.5 ${v ? "bg-[#e1f5ee] text-[#0f6e56]" : "bg-[#f1eee4] text-[#9a968b]"}`}>{k}</span>
              ))}
            </div>
            {selected.notes && <div className="mt-2">{selected.notes}</div>}
            {!selected.implemented && <div className="mt-1 text-[#9a5a12]">This provider isn’t wired end-to-end yet — testnet USDC is the working path.</div>}
          </div>
        )}
        {form.environment === "production" && <div className="rounded-xl border border-[#f0d9a0] bg-[#fff8e6] px-4 py-2 text-xs text-[#6b5410]">Production uses real funds. Confirm the provider is configured + KYC posture before switching.</div>}

        <button className="btn-gold w-fit" onClick={() => onSave(form)}>Save settings</button>
      </div>

      {/* Logs */}
      <div className="grid gap-6 lg:grid-cols-2">
        <LogTable title="Recent payments" rows={data.paymentLogs} cols={["kind", "amount", "currency", "status"]} />
        <LogTable title="Recent KYC events" rows={data.kycLogs} cols={["provider", "status"]} />
      </div>
    </div>
  );
}

function LogTable({ title, rows, cols }: { title: string; rows: any[]; cols: string[] }) {
  return (
    <div>
      <h3 className="mb-2 tracking-tight text-lg text-[#23252f]">{title}</h3>
      <div className="glass divide-y divide-[#eee6d3]">
        {(rows ?? []).length === 0 && <div className="px-4 py-4 text-sm text-[#7a7768]">No records yet.</div>}
        {(rows ?? []).map((r: any) => (
          <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
            <span className="text-[#5f6172]">{cols.map((c) => String(r[c] ?? "—")).join(" · ")}</span>
            <span className="text-xs text-[#9a968b]">{new Date(r.createdAt).toLocaleDateString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Markets({ markets, onCreate, onResolve, onDelete }: any) {
  const default3d = () => new Date(Date.now() + 72 * 3_600_000).toISOString();
  const [f, setF] = useState<{ question: string; category: string; options: string[]; optionFlags: string[]; closeTime: string; bannerUrl: string }>({ question: "", category: MARKET_CATEGORIES[0].key, options: ["", ""], optionFlags: ["", ""], closeTime: default3d(), bannerUrl: "" });
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  const choices = f.options.map((label, i) => ({ label: label.trim(), flagCode: f.optionFlags[i] ?? "" })).filter((choice) => choice.label);
  const opts = choices.map((choice) => choice.label);
  const optionFlags = choices.map((choice) => choice.flagCode);
  const valid = f.question.trim().length >= 3 && opts.length >= 2 && !!f.closeTime;
  const hint = f.question.trim().length < 3 ? "Enter a question (at least 3 characters)." : opts.length < 2 ? "Add at least 2 outcomes." : "";

  function submit() {
    if (!valid) return;
    onCreate({ question: f.question, category: f.category, options: opts, optionFlags, closeTime: f.closeTime, bannerUrl: f.bannerUrl || null });
    setF({ question: "", category: MARKET_CATEGORIES[0].key, options: ["", ""], optionFlags: ["", ""], closeTime: default3d(), bannerUrl: "" });
  }

  async function confirmDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    const deleted = await onDelete(deleteTarget.id, (deleteTarget.participants ?? 0) > 0);
    setDeleting(false);
    if (deleted) setDeleteTarget(null);
  }

  return (
    <div className="space-y-4">
      <div className="glass grid gap-3 p-4">
        <input className="field" placeholder="Prediction question (e.g. Who wins the Q&A round?)" value={f.question} onChange={set("question")} />
        <select className="field" value={f.category} onChange={set("category")}>{MARKET_CATEGORIES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select>
        <MarketOutcomesField
          options={f.options}
          optionFlags={f.optionFlags}
          onChange={(options, optionFlags) => setF((prev) => ({ ...prev, options, optionFlags }))}
        />
        <MarketCloseField value={f.closeTime} onChange={(iso) => setF((prev) => ({ ...prev, closeTime: iso }))} />
        <BannerUpload value={f.bannerUrl} onUploaded={(url) => setF({ ...f, bannerUrl: url })} />
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn-gold w-fit" disabled={!valid} onClick={submit}>Create market</button>
          {!valid && <span className="text-xs text-[#9a968b]">{hint}</span>}
        </div>
      </div>

      {markets.map((m: any) => (
        <div key={m.id} className="glass p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="font-display text-lg text-[#23252f]">{m.question}</div>
              <div className="text-xs text-[#7a7768]">{m.category} · {m.status} · {m.totalPool?.toLocaleString?.() ?? 0} USDC · {m.participants} in</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(m.status === "open" || m.status === "closed") && (
                <>
                {m.status === "open" && <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => onResolve(m.id, "close")}>Close</button>}
                <select className="field !w-auto !py-1.5 text-xs" defaultValue="" onChange={(e) => { if (e.target.value !== "") onResolve(m.id, "resolve", Number(e.target.value)); }}>
                  <option value="">Resolve → winner…</option>
                  {(m.options ?? []).map((o: any) => <option key={o.index} value={o.index}>{o.label}</option>)}
                </select>
                <button className="btn-ghost !px-3 !py-1.5 text-xs !text-[#9f1239]" onClick={() => onResolve(m.id, "cancel")}>Cancel</button>
                </>
              )}
              {m.status === "resolved" && <span className="tag-on">Resolved · {m.options?.[m.winningOption]?.label}</span>}
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#ebd0d0] px-3 py-1.5 text-xs font-semibold text-[#9f1239] transition hover:bg-[#fff1f2]"
                onClick={() => setDeleteTarget(m)}
              >
                <Icons.Trash size={13} strokeWidth={1.8} /> Delete
              </button>
            </div>
          </div>
        </div>
      ))}

      {deleteTarget && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-[#17140d]/45 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget && !deleting) setDeleteTarget(null); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="delete-market-title" className="glass w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="eyebrow mb-2 text-[#9f1239]">Admin force action</div>
                <h2 id="delete-market-title" className="text-xl font-semibold text-[#23252f]">{deleteTarget.participants > 0 ? "Force delete and refund?" : "Delete this market?"}</h2>
              </div>
              <button type="button" aria-label="Close" disabled={deleting} onClick={() => setDeleteTarget(null)} className="rounded-lg p-1.5 text-[#7a7768] hover:bg-[#f3eee2] disabled:opacity-50"><Icons.X size={18} /></button>
            </div>
            <p className="mt-3 text-sm font-medium text-[#3a3f52]">{deleteTarget.question}</p>
            <p className="mt-2 text-sm leading-relaxed text-[#6c6a61]">
              {deleteTarget.participants > 0
                ? "CrownFi will stop this market on Stellar first. V2 stakes are returned directly to their original wallets before deletion. Earlier markets stay cancelled and visible until each participant signs their refund, so no escrow can be lost."
                : "CrownFi will permanently remove this empty database record. An open on-chain market is cancelled first, while its immutable ledger history remains public."}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="btn-ghost" disabled={deleting} onClick={() => setDeleteTarget(null)}>Keep market</button>
              <button type="button" className="inline-flex items-center gap-2 rounded-lg bg-[#9f1239] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#881337] disabled:opacity-60" disabled={deleting} onClick={confirmDelete}>
                <Icons.Trash size={15} /> {deleting ? "Refunding safely…" : deleteTarget.participants > 0 ? "Force delete & refund" : "Delete market"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
