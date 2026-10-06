"use client";
import { useState } from "react";
import type { MarketView } from "@/components/MarketCard";
import { MarketOutcomesField } from "@/components/MarketOutcomesField";
import { MarketCloseField } from "@/components/MarketCloseField";
import { messageFor } from "@/lib/messages";

export function MarketAmendForm({ market, onSaved, onCancel }: { market: MarketView; onSaved: () => void; onCancel: () => void }) {
  const [options, setOptions] = useState(market.options.map((o) => o.label));
  const [flags, setFlags] = useState(market.options.map((o) => o.flagCode ?? ""));
  const [closeTime, setCloseTime] = useState(market.closeTime);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const valid = options.every((o) => o.trim()) && new Set(options.map((o) => o.trim().toLowerCase())).size === options.length
    && new Date(closeTime).getTime() >= new Date(market.closeTime).getTime()
    && (options.length > market.options.length || closeTime !== market.closeTime);
  async function save() {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/markets/${market.id}/amend`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ options, optionFlags: flags, closeTime }) });
      const data = await response.json();
      if (response.ok || data.error === "market_amendment_pending") onSaved();
      else setError(messageFor(data.error, "Could not update this market."));
    } catch { setError("Connection interrupted. Refresh the market to check the update before trying again."); }
    finally { setBusy(false); }
  }
  return <section className="card-gold space-y-4 p-4 sm:p-5" aria-label="Extend live market">
    <h2 className="text-xl font-semibold">Add outcomes or extend the deadline</h2>
    <p className="text-sm text-[#7a7768]">Existing choices and stakes stay in place. New choices can change the pool distribution. The deadline can only move later.</p>
    <fieldset disabled={busy} className="min-w-0 space-y-4"><MarketOutcomesField options={options} optionFlags={flags} lockedCount={market.options.length} onChange={(next, nextFlags) => { setOptions(next); setFlags(nextFlags); }} /><MarketCloseField value={closeTime} onChange={setCloseTime} /></fieldset>
    {!valid && <p className="text-xs text-[#7a7768]">Add a unique outcome or choose a later closing time.</p>}
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    <div className="flex flex-wrap gap-2"><button type="button" disabled={busy || !valid} onClick={save} className="btn-gold min-h-11">{busy ? "Updating market…" : "Save market update"}</button><button type="button" disabled={busy} onClick={onCancel} className="btn-ghost min-h-11">Close</button></div>
  </section>;
}
