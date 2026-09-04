"use client";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "@/session/SessionProvider";
import { MarketCard, MarketView, CATEGORY_LABEL } from "@/components/MarketCard";
import { MarketForm } from "@/components/MarketForm";
import { MARKET_CATEGORIES } from "@/lib/segments";
import { Toast } from "@/components/ui";
import { Icons } from "@/components/icons";

const CATEGORIES = ["all", ...MARKET_CATEGORIES.map((s) => s.key)];
const STATUSES = [
  { key: "all", label: "All" },
  { key: "live", label: "Live" },
  { key: "upcoming", label: "Upcoming" },
  { key: "previous", label: "Previous" },
  { key: "cancelled", label: "Canceled" },
  { key: "mine", label: "My markets" },
];

const PREDICTION_STEPS = [
  { n: "01", t: "Pick a market", d: "Each pageant stage gets a market. The percentages are live odds — the crowd's money talking." },
  { n: "02", t: "Stake USDC", d: "Back an outcome with test USDC. You approve every stake in your own wallet; funds sit in the contract." },
  { n: "03", t: "Watch it move", d: "Odds shift as fans take sides. Change your mind? Cancel any position before close for a full refund." },
  { n: "04", t: "Claim winnings", d: "When the result is resolved on-chain, winners split the whole pool. Fee is 2% of profit only." },
];

export default function PredictionsLanding() {
  const { fan } = useSession();
  const [markets, setMarkets] = useState<MarketView[] | null>(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [status, setStatus] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [instructionStep, setInstructionStep] = useState(0);
  const [autoInstructions, setAutoInstructions] = useState(true);
  const [toast, setToast] = useState({ msg: "", tone: "ok" as "ok" | "err" });
  const flash = (msg: string, tone: "ok" | "err" = "ok") => { setToast({ msg, tone }); setTimeout(() => setToast({ msg: "", tone: "ok" }), 3200); };
  const openConnectChooser = () => window.dispatchEvent(new Event("crownfi:open-connect"));

  function load() {
    fetch("/api/markets", { cache: "no-store" }).then((r) => r.json()).then((d) => setMarkets(Array.isArray(d) ? d : [])).catch(() => setMarkets([]));
  }
  useEffect(() => {
    load();
    // Live pools — but don't hammer the API when the tab isn't being looked at.
    const iv = setInterval(() => { if (document.visibilityState === "visible") load(); }, 15000);
    return () => clearInterval(iv);
  }, [fan?.id]);

  useEffect(() => {
    if (!autoInstructions || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      if (window.matchMedia("(max-width: 639px)").matches) {
        setInstructionStep((step) => (step + 1) % PREDICTION_STEPS.length);
      }
    }, 4500);
    return () => window.clearInterval(timer);
  }, [autoInstructions]);

  const showInstruction = (index: number) => {
    setAutoInstructions(false);
    setInstructionStep((index + PREDICTION_STEPS.length) % PREDICTION_STEPS.length);
  };

  const filtered = useMemo(() => {
    if (!markets) return [];
    return markets.filter((m) => {
      if (cat !== "all" && m.category !== cat) return false;
      if (status === "live" && !m.live) return false;
      if (status === "upcoming" && !(m.status === "open" && !m.live)) return false;
      if (status === "previous" && !(m.status === "closed" || m.status === "resolved" || (m.status === "open" && !m.live))) return false;
      if (status === "cancelled" && m.status !== "cancelled") return false;
      if (status === "mine" && !m.isCreator) return false;
      if (q && !m.question.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [markets, cat, status, q]);

  const live = filtered.filter((m) => m.live).sort((a, b) => (b.official ? 1 : 0) - (a.official ? 1 : 0));
  const defaultView = status === "all" && cat === "all" && !q;
  const sectionMarkets = defaultView ? filtered.filter((m) => !m.live) : filtered;

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
          <button className="btn-ghost w-full sm:w-auto" onClick={openConnectChooser}>Sign in to create</button>
        )}
      </header>

      {/* One auto-looping instruction at a time on mobile; all four stay visible on desktop. */}
      <section aria-label="How prediction markets work">
        <div className="grid sm:grid-cols-2 sm:gap-3 lg:grid-cols-4">
          {PREDICTION_STEPS.map((step, index) => (
            <article key={step.n} className={`card-gold min-h-44 p-5 ${index === instructionStep ? "block" : "hidden"} sm:block`}>
              <div className="font-display text-sm font-semibold tabular-nums text-[#a97f16]">{step.n}</div>
              <div className="mt-1 font-display text-2xl font-semibold text-[#23252f]">{step.t}</div>
              <p className="mt-2 text-xs leading-relaxed text-[#5f6172]">{step.d}</p>
            </article>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-center gap-3 sm:hidden">
          <button type="button" onClick={() => showInstruction(instructionStep - 1)} className="btn-ghost h-10 w-10 !px-0" aria-label="Previous instruction"><Icons.Prev size={16} strokeWidth={2} /></button>
          <div className="flex items-center gap-2" aria-label={`Instruction ${instructionStep + 1} of ${PREDICTION_STEPS.length}`}>
            {PREDICTION_STEPS.map((step, index) => (
              <button key={step.n} type="button" onClick={() => showInstruction(index)} aria-label={`Show instruction ${index + 1}: ${step.t}`} aria-pressed={index === instructionStep} className={`h-2 rounded-full transition-all ${index === instructionStep ? "w-6 bg-[#c8a233]" : "w-2 bg-[#d9d3c3]"}`} />
            ))}
          </div>
          <button type="button" onClick={() => showInstruction(instructionStep + 1)} className="btn-ghost h-10 w-10 !px-0" aria-label="Next instruction"><Icons.Next size={16} strokeWidth={2} /></button>
        </div>
      </section>

      {showCreate && fan && <MarketForm onSaved={() => { setShowCreate(false); load(); flash("Prediction market created!"); }} onCancel={() => setShowCreate(false)} onError={(m) => flash(m, "err")} />}

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
            s.key === "mine" && !fan ? null :
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
      {markets !== null && defaultView && live.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 tracking-tight text-2xl font-semibold text-[#23252f]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#c0392b] opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#c0392b]" />
            </span>
            Live now
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {live.map((m) => <MarketCard key={m.id} m={m} />)}
          </div>
        </section>
      )}

      {/* Closed history by default; the selected subset when filters are active. */}
      {markets !== null && (
        <section>
          {defaultView && <h2 className="mb-3 tracking-tight text-2xl font-semibold text-[#23252f]">Closed markets</h2>}
          {sectionMarkets.length === 0 ? (
            <div className="glass p-10 text-center">
              <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full surface-soft text-[#a97f16]"><Icons.Search size={20} strokeWidth={1.75} /></div>
              {!defaultView ? (
                <>
                  <div className="font-display text-xl text-[#23252f]">No markets match your filters</div>
                  <p className="mt-2 text-sm text-[#7a7768]">Try a different category or clear your search.</p>
                  <button onClick={() => { setQ(""); setCat("all"); setStatus("all"); }} className="btn-ghost mt-4">Clear filters</button>
                </>
              ) : (
                <>
                  <div className="font-display text-xl text-[#23252f]">No closed markets yet</div>
                  <p className="mt-2 text-sm text-[#7a7768]">Completed and cancelled markets will appear here as an auditable history.</p>
                </>
              )}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sectionMarkets.map((m) => <MarketCard key={m.id} m={m} />)}
            </div>
          )}
        </section>
      )}

      <Toast msg={toast.msg} tone={toast.tone} />
    </div>
  );
}
