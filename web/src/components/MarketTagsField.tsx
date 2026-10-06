"use client";
import { useState } from "react";
import { parseMarketTags, SUGGESTED_MARKET_TAGS } from "@/lib/predictionUpdates";

export function MarketTagsField({ value, onChange }: { value: string[]; onChange: (value: string[]) => void }) {
  const [custom, setCustom] = useState("");
  const [error, setError] = useState("");
  function toggle(tag: string) {
    const existing = value.find((v) => v.toLowerCase() === tag.toLowerCase());
    const next = existing ? value.filter((v) => v !== existing) : parseMarketTags([...value, tag]);
    if (!next) { setError("Use up to 8 tags, each with 1–24 letters, numbers, spaces, +, & or -."); return; }
    onChange(next); setError(""); setCustom("");
  }
  return <fieldset className="space-y-2"><legend className="text-xs font-semibold text-[#5f6172]">Tags · choose more than one (optional)</legend>
    <div className="flex flex-wrap gap-2">{[...new Set([...SUGGESTED_MARKET_TAGS, ...value])].map((tag) => <button key={tag} type="button" aria-pressed={value.includes(tag)} onClick={() => toggle(tag)} className={`min-h-11 rounded-full border px-3 text-sm ${value.includes(tag) ? "border-[#b8912f] bg-[#fff4d1]" : "border-[#e7e2d3] bg-white"}`}>#{tag}</button>)}</div>
    <div className="flex gap-2"><input className="field min-w-0 !text-base" aria-label="Custom market tag" placeholder="Add another tag" maxLength={24} value={custom} onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (custom.trim()) toggle(custom.trim().replace(/^#/, "")); } }} /><button type="button" className="btn-ghost min-h-11 shrink-0" disabled={!custom.trim()} onClick={() => toggle(custom.trim().replace(/^#/, ""))}>Add tag</button></div>
    {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
  </fieldset>;
}
