"use client";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "@/session/SessionProvider";
import { MarketCard, MarketView, CATEGORY_LABEL } from "@/components/MarketCard";
import { BannerUpload } from "@/components/BannerUpload";
import { MarketCloseField } from "@/components/MarketCloseField";
import { MARKET_CATEGORIES } from "@/lib/segments";
import { messageFor } from "@/lib/messages";
import { Toast } from "@/components/ui";
import { Icons } from "@/components/icons";
import { Flag } from "@/components/Flag";

const CATEGORIES = ["all", ...MARKET_CATEGORIES.map((s) => s.key)];
const STATUSES = [
  { key: "all", label: "All" },
  { key: "live", label: "Live" },
  { key: "upcoming", label: "Upcoming" },
  { key: "previous", label: "Previous" },
  { key: "cancelled", label: "Canceled" },
];

export default function PredictionsLanding() {
  const { fan, connect, connecting } = useSession();
  const [markets, setMarkets] = useState<MarketView[] | null>(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [status, setStatus] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [toast, setToast] = useState({ msg: "", tone: "ok" as "ok" | "err" });
  const flash = (msg: string, tone: "ok" | "err" = "ok") => { setToast({ msg, tone }); setTimeout(() => setToast({ msg: "", tone: "ok" }), 3200); };

  function load() {
    fetch("/api/markets", { cache: "no-store" }).then((r) => r.json()).then((d) => setMarkets(Array.isArray(d) ? d : [])).catch(() => setMarkets([]));
  }
  useEffect(() => {
    load();
    // Live pools — but don't hammer the API when the tab isn't being looked at.
    const iv = setInterval(() => { if (document.visibilityState === "visible") load(); }, 15000);
    return () => clearInterval(iv);
  }, []);

  const filtered = useMemo(() => {
    if (!markets) return [];
    return markets.filter((m) => {
      if (cat !== "all" && m.category !== cat) return false;
      if (status === "live" && !m.live) return false;
      if (status === "upcoming" && !(m.status === "open" && !m.live)) return false;
      if (status === "previous" && m.status !== "closed" && m.status !== "resolved") return false;
      if (status === "cancelled" && m.status !== "cancelled") return false;
      if (q && !m.question.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [markets, cat, status, q]);

  const live = filtered.filter((m) => m.live).sort((a, b) => (b.official ? 1 : 0) - (a.official ? 1 : 0));

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow mb-2">Prediction markets</div>
          <h1 className="tracking-tight text-4xl font-semibold text-[#23252f] sm:text-5xl">Predict the <span className="font-display italic text-[#c8a233]">crown</span></h1>
          <p className="mt-2 max-w-xl text-sm text-[#5f6172]">Back your call on pageant outcomes. Browse freely — connect only when you stake.</p>
          {markets !== null && markets.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="chip tabular-nums">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#c0392b] opacity-70" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#c0392b]" />
                </span>
                {markets.filter((m) => m.live).length} live
              </span>
              <span className="chip tabular-nums">{markets.reduce((s, m) => s + m.totalPool, 0).toLocaleString()} USDC pooled</span>
              <span className="chip tabular-nums">{markets.reduce((s, m) => s + m.participants, 0)} predicting</span>
            </div>
          )}
        </div>
        {fan ? (
          <button className="btn-gold w-full sm:w-auto" onClick={() => setShowCreate((s) => !s)}>{showCreate ? "Close" : "Create a prediction"}</button>
        ) : (
          <button className="btn-ghost w-full sm:w-auto" onClick={connect}>{connecting ? "Connecting…" : "Connect to create"}</button>
        )}
      </header>

      {/* How it works — numbered walk-through, reference-style */}
      <section className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 no-scrollbar sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
        {[
          { n: "01", t: "Pick a market", d: "Each pageant stage gets a market. The percentages are live odds — the crowd's money talking." },
          { n: "02", t: "Stake USDC", d: "Back an outcome with test USDC. You approve every stake in your own wallet; funds sit in the contract." },
          { n: "03", t: "Watch it move", d: "Odds shift as fans take sides. Change your mind? Cancel any position before close for a full refund." },
          { n: "04", t: "Claim winnings", d: "When the result is resolved on-chain, winners split the whole pool. Fee is 2% of profit only." },
        ].map((s) => (
          <div key={s.n} className="card-gold w-[82vw] max-w-sm shrink-0 snap-start p-5 sm:w-auto sm:max-w-none">
            <div className="font-display text-sm font-semibold tabular-nums text-[#a97f16]">{s.n}</div>
            <div className="mt-1 font-display text-2xl font-semibold text-[#23252f]">{s.t}</div>
            <p className="mt-2 text-xs leading-relaxed text-[#5f6172]">{s.d}</p>
          </div>
        ))}
      </section>

      {showCreate && fan && <CreateMarket onCreated={() => { setShowCreate(false); load(); flash("Prediction market created!"); }} onError={(m) => flash(m, "err")} />}

      {/* Search + filters (sticky so they stay reachable while scrolling the grid) */}
      <div className="sticky top-2 z-20 -mx-2 space-y-3 rounded-2xl border border-[#efe4c2]/70 bg-[#fbf9f2]/85 px-3 py-3 backdrop-blur-xl sm:top-3">
        <div className="relative">
          <Icons.Search size={16} strokeWidth={2} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9a968b]" />
          <input className="field !pl-9" placeholder="Search markets…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search markets" />
          {q && <button onClick={() => setQ("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-[#9a968b] hover:text-[#23252f]"><Icons.X size={14} strokeWidth={2} /></button>}
        </div>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 no-scrollbar">
          {CATEGORIES.map((c) => (
            <button key={c} onClick={() => setCat(c)} aria-pressed={cat === c} className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${cat === c ? "border-[#a97f16]/40 bg-gradient-to-b from-[#e4c358] to-[#c39a2c] text-[#1a1f35] shadow-sm" : "border-[#e7e2d3] bg-white text-[#5f6172] hover:border-[#c9a227]"}`}>
              {c === "all" ? "All categories" : (CATEGORY_LABEL[c] ?? c)}
            </button>
          ))}
        </div>
        <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-0.5 no-scrollbar">
          {STATUSES.map((s) => (
            <button key={s.key} onClick={() => setStatus(s.key)} aria-pressed={status === s.key} className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${status === s.key ? "border-[#a97f16]/50 bg-[rgba(0,0,0,0.842)] text-[#ffd277]" : "border-[#e7e2d3] bg-white text-[#5f6172] hover:border-[#c9a227]"}`}>
              {s.label}
            </button>
          ))}
          {markets !== null && <span className="ml-auto shrink-0 text-xs tabular-nums text-[#9a968b]">{filtered.length} market{filtered.length === 1 ? "" : "s"}</span>}
        </div>
      </div>

      {/* Loading — card-shaped skeletons (reserve space to avoid layout shift) */}
      {markets === null && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass overflow-hidden">
              <div className="h-24 w-full animate-pulse bg-[#efe9d8]" />
              <div className="space-y-3 p-4">
                <div className="h-4 w-3/4 animate-pulse rounded bg-[#efe9d8]" />
                <div className="h-2 w-full animate-pulse rounded bg-[#efe9d8]" />
                <div className="h-2 w-2/3 animate-pulse rounded bg-[#efe9d8]" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Featured live */}
      {markets !== null && status === "all" && cat === "all" && !q && live.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 tracking-tight text-2xl font-semibold text-[#23252f]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#c0392b] opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#c0392b]" />
            </span>
            Live now
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {live.slice(0, 3).map((m) => <MarketCard key={m.id} m={m} />)}
          </div>
        </section>
      )}

      {/* All (filtered) */}
      {markets !== null && (
        <section>
          {status === "all" && cat === "all" && !q && <h2 className="mb-3 tracking-tight text-2xl font-semibold text-[#23252f]">All markets</h2>}
          {filtered.length === 0 ? (
            <div className="glass p-10 text-center">
              <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full surface-soft text-[#a97f16]"><Icons.Search size={20} strokeWidth={1.75} /></div>
              {q || cat !== "all" || status !== "all" ? (
                <>
                  <div className="font-display text-xl text-[#23252f]">No markets match your filters</div>
                  <p className="mt-2 text-sm text-[#7a7768]">Try a different category or clear your search.</p>
                  <button onClick={() => { setQ(""); setCat("all"); setStatus("all"); }} className="btn-ghost mt-4">Clear filters</button>
                </>
              ) : (
                <>
                  <div className="font-display text-xl text-[#23252f]">No markets yet</div>
                  <p className="mt-2 text-sm text-[#7a7768]">Prediction markets open up as pageants go live — or open your own above.</p>
                </>
              )}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((m) => <MarketCard key={m.id} m={m} />)}
            </div>
          )}
        </section>
      )}

      <Toast msg={toast.msg} tone={toast.tone} />
    </div>
  );
}

function CreateMarket({ onCreated, onError }: { onCreated: () => void; onError: (m: string) => void }) {
  const [question, setQuestion] = useState("");
  const [category, setCategory] = useState<string>(MARKET_CATEGORIES[0].key);
  const [options, setOptions] = useState<string[]>(["", ""]); // start with two outcome fields
  const [optionFlags, setOptionFlags] = useState<string[]>(["", ""]);
  const [closeTime, setCloseTime] = useState(() => new Date(Date.now() + 72 * 3_600_000).toISOString()); // default: 3 days
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const setOption = (i: number, v: string) => setOptions((prev) => prev.map((o, idx) => (idx === i ? v : o)));
  const setOptionFlag = (i: number, v: string) => setOptionFlags((prev) => prev.map((code, idx) => (idx === i ? v.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2) : code)));
  const addOption = () => {
    setOptions((prev) => (prev.length < 32 ? [...prev, ""] : prev));
    setOptionFlags((prev) => (prev.length < 32 ? [...prev, ""] : prev));
  };
  const removeOption = (i: number) => {
    setOptions((prev) => prev.filter((_, idx) => idx !== i));
    setOptionFlags((prev) => prev.filter((_, idx) => idx !== i));
  };

  const choices = options.map((label, i) => ({ label: label.trim(), flagCode: optionFlags[i] ?? "" })).filter((choice) => choice.label);
  const opts = choices.map((choice) => choice.label);
  const flags = choices.map((choice) => choice.flagCode);
  const valid = question.trim().length >= 3 && opts.length >= 2 && !!closeTime;
  // Human-readable reason the button is disabled (so it never feels "broken").
  const hint = question.trim().length < 3 ? "Enter a question (at least 3 characters)."
    : opts.length < 2 ? "Add at least 2 outcomes."
    : !closeTime ? "Choose when predictions lock." : "";

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/markets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, category, options: opts, optionFlags: flags, closeTime, bannerUrl }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.id) onCreated();
      else onError(messageFor(d.error, "Could not create market."));
    } catch {
      onError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card-gold space-y-3 p-5">
      <h3 className="tracking-tight text-xl font-semibold text-[#23252f]">Create a market</h3>
      <input className="field" placeholder="Question (e.g. Who wins the Q&A round?)" value={question} onChange={(e) => setQuestion(e.target.value)} />
      <select className="field" value={category} onChange={(e) => setCategory(e.target.value)}>
        {MARKET_CATEGORIES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
      </select>

      {/* Outcomes — one field each, add/remove rows */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-[#5f6172]">Outcomes <span className="font-normal text-[#9a968b]">· add an optional 2-letter country code for its flag</span></div>
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-5 shrink-0 text-right text-xs tabular-nums text-[#9a968b]">{i + 1}</span>
            <input className="field min-w-0 !text-base sm:!text-sm" placeholder={`Outcome ${i + 1}`} value={opt} onChange={(e) => setOption(i, e.target.value)} />
            <label className="relative flex w-[4.25rem] shrink-0 items-center sm:w-[4.75rem]">
              <span className="pointer-events-none absolute left-2.5 z-10 flex h-4 w-6 items-center justify-center"><Flag sash={optionFlags[i]} className="!h-4 !w-6" /></span>
              <input className="field !pl-10 !pr-2 uppercase" aria-label={`Country code for outcome ${i + 1}`} title="Optional ISO country code, such as PH" maxLength={2} placeholder="Flag" value={optionFlags[i]} onChange={(e) => setOptionFlag(i, e.target.value)} />
            </label>
            {options.length > 2 && (
              <button type="button" onClick={() => removeOption(i)} aria-label={`Remove outcome ${i + 1}`} className="shrink-0 rounded-lg border border-[#e7e2d3] p-2 text-[#9a968b] transition hover:border-[#e7d0d0] hover:text-[#9f1239]">
                <Icons.X size={14} strokeWidth={2} />
              </button>
            )}
          </div>
        ))}
        {options.length < 32 && (
          <button type="button" onClick={addOption} className="text-sm font-semibold text-[#a97f16] hover:underline">+ Add outcome</button>
        )}
      </div>

      <MarketCloseField value={closeTime} onChange={setCloseTime} />
      <BannerUpload value={bannerUrl} onUploaded={setBannerUrl} />
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-gold w-fit" disabled={!valid || busy} onClick={submit}>{busy ? "Creating…" : "Create market"}</button>
        {!valid && !busy && <span className="text-xs text-[#9a968b]">{hint}</span>}
      </div>
    </div>
  );
}
