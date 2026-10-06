"use client";
import { useEffect, useRef, useState } from "react";
import { OutcomeMarker } from "@/components/OutcomeMarker";
import { RANKING_SIZES, readDeviceRankings } from "@/lib/predictionUpdates";
import type { MarketView } from "@/components/MarketCard";

export function PersonalRanking({ market, fanId }: { market: MarketView; fanId?: string }) {
  const [size, setSize] = useState(3);
  const [drafts, setDrafts] = useState<Record<number, number[]>>({});
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(Boolean(fanId));
  const [loadFailed, setLoadFailed] = useState(false);
  const [dragged, setDragged] = useState<number | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const selected = drafts[size] ?? [];
  const closed = market.status !== "open" || market.endsInMs <= 0;
  const storageKey = `crownfi:ranking:v1:${fanId ?? "guest"}:${market.id}`;
  useEffect(() => {
    if (!fanId) return;
    try {
      const raw = localStorage.getItem(storageKey);
      const saved = readDeviceRankings(raw, market.options.map((o) => o.label));
      setDrafts(Object.fromEntries(saved.map((r) => [r.size, r.options])));
      if (raw && saved.length !== JSON.parse(raw).length) setMessage("The candidate list changed. Please rebuild affected rankings.");
    } catch { setLoadFailed(true); setMessage("Could not read rankings on this device. Enable browser storage and refresh before editing."); }
    finally { setLoading(false); }
  }, [market.id, fanId]); // Component is keyed by account and candidate list in the parent.
  function update(next: number[]) { setDrafts((prev) => ({ ...prev, [size]: next })); setMessage("Unsaved ranking"); }
  function move(index: number, to: number) {
    const from = selected.indexOf(index);
    if (from < 0 || to < 0 || to >= selected.length || from === to) return;
    const next = [...selected]; next.splice(from, 1); next.splice(to, 0, index); update(next);
  }
  function save() {
    setBusy(true);
    try {
      const saved = readDeviceRankings(localStorage.getItem(storageKey), market.options.map((o) => o.label));
      localStorage.setItem(storageKey, JSON.stringify([...saved.filter((r) => r.size !== size), { size, options: selected, labels: selected.map((i) => market.options[i].label) }]));
      setMessage(`Top ${size} saved on this device. No stake was placed.`);
    } catch { setMessage("Could not save in this browser. Your draft is still here; check that browser storage is enabled."); }
    finally { setBusy(false); }
  }
  const available = market.options.filter((o) => !selected.includes(o.index) && o.label.toLowerCase().includes(query.trim().toLowerCase()));
  const disabled = loading || loadFailed || busy || closed;
  return (
    <section className="glass min-w-0 space-y-4 p-4 sm:p-5" aria-label="Personal ranking">
      <div><h2 className="text-xl font-semibold">My predicted finalists</h2><p className="mt-1 text-sm text-[#7a7768]">Build your personal Top 20, 10, 5 or 3. Saved only in this browser on this device—not synced across devices. These picks do not place a stake or earn a payout.</p></div>
      <div className="flex flex-wrap gap-2">{RANKING_SIZES.map((n) => <button key={n} type="button" disabled={busy || loading || loadFailed || market.options.length < n} aria-pressed={size === n} onClick={() => { setSize(n); setMessage(""); }} className={`min-h-11 rounded-lg border px-4 text-sm disabled:opacity-40 ${size === n ? "border-[#b8912f] bg-[#fff4d1]" : "border-[#e7e2d3]"}`}>Top {n}</button>)}</div>
      <p className="text-xs text-[#7a7768]">{selected.length}/{size} selected. Drag the grip to reorder, or use the arrow buttons.</p>
      <ol ref={listRef} className="max-h-[28rem] space-y-2 overflow-y-auto rounded-xl border border-[#eee6d3] p-2">
        {selected.length === 0 && <li className="p-3 text-sm text-[#7a7768]">Choose candidates below to start your ranking.</li>}
        {selected.map((index, position) => { const o = market.options[index]; return <li key={index} data-ranking-index={index} className={`grid min-w-0 grid-cols-[2rem_1.25rem_minmax(0,1fr)] items-center gap-x-2 rounded-lg border p-2 sm:grid-cols-[2rem_1.25rem_minmax(0,1fr)_auto] ${dragged === index ? "border-[#b8912f] bg-[#fff4d1]" : "border-[#eee6d3] bg-white"}`}>
          <button type="button" disabled={disabled} aria-label={`Drag ${o.label} to reorder`} className="min-h-11 min-w-8 touch-none cursor-grab text-xl"
            onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setDragged(index); }}
            onPointerMove={(e) => { if (dragged !== index) return; const list = listRef.current; if (!list) return; const rect = list.getBoundingClientRect(); if (e.clientY < rect.top + 40) list.scrollTop -= 14; if (e.clientY > rect.bottom - 40) list.scrollTop += 14; const row = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-ranking-index]'); const target = row?.getAttribute('data-ranking-index'); if (row && list.contains(row) && target != null) move(index, selected.indexOf(Number(target))); }}
            onPointerUp={() => setDragged(null)} onPointerCancel={() => setDragged(null)} onLostPointerCapture={() => setDragged(null)}>⠿<span className="block text-xs font-bold sm:hidden">{position + 1}</span></button>
          <span className="hidden w-5 text-sm font-bold sm:block">{position + 1}</span>
          <span className="col-span-2 flex min-w-0 items-start gap-2 py-1 sm:col-span-1"><OutcomeMarker label={o.label} flagCode={o.flagCode} className="mt-0.5 !h-4 !w-6 shrink-0" /><span className="min-w-0 break-words text-sm">{o.label}</span></span>
          <div className="col-span-3 col-start-1 flex flex-wrap items-center justify-end sm:col-span-1 sm:col-start-auto"><button type="button" aria-label={`Move ${o.label} up`} disabled={disabled || position === 0} onClick={() => move(index, position - 1)} className="min-h-11 min-w-11 disabled:opacity-30">↑</button><button type="button" aria-label={`Move ${o.label} down`} disabled={disabled || position === selected.length - 1} onClick={() => move(index, position + 1)} className="min-h-11 min-w-11 disabled:opacity-30">↓</button><button type="button" aria-label={`Remove ${o.label} from ranking`} disabled={disabled} onClick={() => update(selected.filter((i) => i !== index))} className="min-h-11 min-w-11 text-[#9f1239]">×</button></div>
        </li>; })}
      </ol>
      {!closed && selected.length < size && <div className="space-y-2"><input className="field !text-base" aria-label="Search ranking candidates" placeholder="Search country or candidate…" value={query} onChange={(e) => setQuery(e.target.value)} /><div className="max-h-56 overflow-y-auto">{available.slice(0, 30).map((o) => <button key={o.index} type="button" disabled={disabled} onClick={() => update([...selected, o.index])} className="flex min-h-11 w-full items-center gap-2 border-b border-[#eee6d3] p-2 text-left text-sm"><OutcomeMarker label={o.label} flagCode={o.flagCode} className="!h-4 !w-6 shrink-0" /><span className="min-w-0 flex-1 break-words">{o.label}</span><span aria-hidden>+</span></button>)}{available.length === 0 && <p className="p-2 text-sm">No candidates match.</p>}</div>{available.length > 30 && <p className="text-xs text-[#7a7768]">Showing 30 of {available.length}. Search to narrow the list.</p>}</div>}
      {closed ? <p className="text-sm text-[#7a7768]">Rankings are locked after this market closes.</p> : fanId ? <button type="button" disabled={disabled || selected.length !== size} onClick={save} className="btn-gold min-h-11 w-full sm:w-auto">{busy ? "Saving…" : `Save my Top ${size}`}</button> : <button type="button" className="btn-ghost min-h-11" onClick={() => window.dispatchEvent(new Event("crownfi:open-connect"))}>Sign in to save your ranking</button>}
      <p role="status" className="text-sm text-[#7a7768]">{loading ? "Loading your rankings…" : message}</p>
    </section>
  );
}
