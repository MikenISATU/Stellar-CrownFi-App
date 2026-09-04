"use client";

import { useEffect, useRef, useState } from "react";
import { Flag } from "@/components/Flag";
import { Icons } from "@/components/icons";
import { COUNTRY_OPTIONS, countryCodeFor, countryName } from "@/lib/countries";
import { binaryOutcomeSymbol, MAX_MARKET_OPTIONS, parseOutcomeList } from "@/lib/marketOptions";

type Props = {
  options: string[];
  optionFlags: string[];
  onChange: (options: string[], optionFlags: string[]) => void;
};

function CountryField({ code, outcome, index, onChange }: { code: string; outcome: string; index: number; onChange: (code: string) => void }) {
  const [text, setText] = useState(countryName(code));
  const binary = binaryOutcomeSymbol(outcome);
  useEffect(() => setText(countryName(code)), [code]);
  if (binary) {
    return (
      <div className={`field flex min-h-[44px] items-center gap-2 !py-2 text-sm ${binary === "yes" ? "text-emerald-700" : "text-rose-700"}`}>
        <span className="text-base font-bold" aria-hidden>{binary === "yes" ? "✓" : "✕"}</span>
        {binary === "yes" ? "Yes option" : "No option"}
      </div>
    );
  }
  return (
    <label className="relative block min-w-0">
      <span className="pointer-events-none absolute left-3 top-1/2 z-10 flex h-4 w-6 -translate-y-1/2 items-center justify-center"><Flag sash={countryCodeFor(text) || code} className="!h-4 !w-6" /></span>
      <input
        list="crownfi-country-options"
        className="field !pl-11 !text-base sm:!text-sm"
        aria-label={`Country flag for outcome ${index + 1}`}
        placeholder="Country / flag (optional)"
        value={text}
        onChange={(event) => {
          const next = event.target.value;
          setText(next);
          const resolved = countryCodeFor(next);
          if (resolved) onChange(resolved);
          else if (!next) onChange("");
        }}
        onBlur={() => {
          const resolved = countryCodeFor(text);
          setText(countryName(resolved));
          onChange(resolved);
        }}
      />
    </label>
  );
}

export function MarketOutcomesField({ options, optionFlags, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadNote, setUploadNote] = useState("");

  function setOption(index: number, value: string) {
    const nextOptions = options.map((option, optionIndex) => (optionIndex === index ? value : option));
    const nextFlags = optionFlags.map((code, optionIndex) => (optionIndex === index && binaryOutcomeSymbol(value) ? "" : code));
    onChange(nextOptions, nextFlags);
  }

  function setOptionFlag(index: number, value: string) {
    onChange(options, optionFlags.map((code, optionIndex) => (optionIndex === index ? value : code)));
  }

  function addOption() {
    if (options.length >= MAX_MARKET_OPTIONS) return;
    onChange([...options, ""], [...optionFlags, ""]);
  }

  function removeOption(index: number) {
    onChange(options.filter((_, optionIndex) => optionIndex !== index), optionFlags.filter((_, optionIndex) => optionIndex !== index));
  }

  async function upload(file?: File) {
    if (!file) return;
    const parsed = parseOutcomeList(await file.text());
    if (parsed.length < 2) {
      setUploadNote("The list needs at least two non-empty outcomes.");
      return;
    }
    onChange(parsed.map((outcome) => outcome.label), parsed.map((outcome) => outcome.flagCode));
    setUploadNote(`${parsed.length} outcomes loaded${parsed.length === MAX_MARKET_OPTIONS ? ` (maximum ${MAX_MARKET_OPTIONS})` : ""}.`);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-semibold text-[#5f6172]">Outcomes <span className="font-normal text-[#9a968b]">· country / flag is optional</span></div>
        <div className="flex items-center gap-2">
          <input ref={fileRef} className="sr-only" type="file" accept=".txt,.csv,text/plain,text/csv" onChange={(event) => upload(event.target.files?.[0])} />
          <button type="button" onClick={() => fileRef.current?.click()} className="min-h-[40px] rounded-lg border border-[#d9c98f] bg-white px-3 py-2 text-xs font-semibold text-[#8a6d1f] transition hover:border-[#c9a227]">
            Upload outcome list
          </button>
        </div>
      </div>
      <p className="text-[11px] leading-relaxed text-[#9a968b]">TXT: one outcome per line. CSV: use Outcome, Country or Country, Candidate. Uploading replaces the current list and supports up to {MAX_MARKET_OPTIONS} outcomes.</p>
      {uploadNote && <p role="status" className="text-xs font-medium text-[#6f5a22]">{uploadNote}</p>}
      <datalist id="crownfi-country-options">
        {COUNTRY_OPTIONS.map((country) => <option key={country.code} value={country.name}>{country.code}</option>)}
      </datalist>
      <div className="max-h-[32rem] space-y-2 overflow-y-auto pr-1">
        {options.map((option, index) => (
          <div key={index} className="flex items-start gap-2">
            <span className="mt-3 w-5 shrink-0 text-right text-xs tabular-nums text-[#9a968b]">{index + 1}</span>
            <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[12rem_minmax(0,1fr)]">
              <CountryField code={optionFlags[index] ?? ""} outcome={option} index={index} onChange={(code) => setOptionFlag(index, code)} />
              <input className="field min-w-0 !text-base sm:!text-sm" maxLength={120} placeholder={`Outcome ${index + 1}`} value={option} onChange={(event) => setOption(index, event.target.value)} />
            </div>
            {options.length > 2 && (
              <button type="button" onClick={() => removeOption(index)} aria-label={`Remove outcome ${index + 1}`} className="mt-1 shrink-0 rounded-lg border border-[#e7e2d3] p-2.5 text-[#9a968b] transition hover:border-[#e7d0d0] hover:text-[#9f1239]">
                <Icons.X size={14} strokeWidth={2} />
              </button>
            )}
          </div>
        ))}
      </div>
      {options.length < MAX_MARKET_OPTIONS && <button type="button" onClick={addOption} className="min-h-[44px] text-sm font-semibold text-[#a97f16] hover:underline">+ Add outcome</button>}
    </div>
  );
}
