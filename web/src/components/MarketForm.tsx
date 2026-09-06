"use client";

import { useRef, useState } from "react";
import { BannerUpload } from "@/components/BannerUpload";
import { Icons } from "@/components/icons";
import { MarketCloseField } from "@/components/MarketCloseField";
import { MarketOutcomesField } from "@/components/MarketOutcomesField";
import { MARKET_CATEGORIES } from "@/lib/segments";
import { messageFor } from "@/lib/messages";
import { binaryOutcomeSymbol } from "@/lib/marketOptions";

export type MarketFormValue = {
  pageantId?: string | null;
  question: string;
  category: string;
  options: { label: string; flagCode: string | null }[];
  closeTime: string;
  bannerUrl: string | null;
};

type Props = {
  marketId?: string;
  initial?: MarketFormValue;
  onSaved: () => void;
  onCancel?: () => void;
  onError: (message: string) => void;
};

type OutcomeType = "candidates" | "binary";

function isBinaryMarket(options?: MarketFormValue["options"]): boolean {
  if (options?.length !== 2) return false;
  const symbols = options.map((option) => binaryOutcomeSymbol(option.label));
  return symbols.includes("yes") && symbols.includes("no");
}

export function MarketForm({ marketId, initial, onSaved, onCancel, onError }: Props) {
  const editing = Boolean(marketId);
  const initialIsBinary = isBinaryMarket(initial?.options);
  const initialOptions = initial?.options.map((option) => option.label) ?? ["", ""];
  const initialFlags = initial?.options.map((option) => option.flagCode ?? "") ?? ["", ""];
  const [question, setQuestion] = useState(initial?.question ?? "");
  const [category, setCategory] = useState(initial?.category ?? MARKET_CATEGORIES[0].key);
  const [outcomeType, setOutcomeType] = useState<OutcomeType>(initialIsBinary ? "binary" : "candidates");
  const [options, setOptions] = useState<string[]>(initialIsBinary ? ["Yes", "No"] : initialOptions);
  const [optionFlags, setOptionFlags] = useState<string[]>(initialIsBinary ? ["", ""] : initialFlags);
  const [closeTime, setCloseTime] = useState(initial?.closeTime ?? new Date(Date.now() + 72 * 3_600_000).toISOString());
  const [bannerUrl, setBannerUrl] = useState<string | null>(initial?.bannerUrl ?? null);
  const [busy, setBusy] = useState(false);
  const candidateDraft = useRef({
    options: initialIsBinary ? ["", ""] : initialOptions,
    optionFlags: initialIsBinary ? ["", ""] : initialFlags,
  });

  const setOutcomes = (nextOptions: string[], nextFlags: string[]) => {
    setOptions(nextOptions);
    setOptionFlags(nextFlags);
    candidateDraft.current = { options: nextOptions, optionFlags: nextFlags };
  };

  function changeOutcomeType(nextType: OutcomeType) {
    if (nextType === outcomeType) return;
    if (nextType === "binary") {
      candidateDraft.current = { options, optionFlags };
      setOptions(["Yes", "No"]);
      setOptionFlags(["", ""]);
    } else {
      setOptions(candidateDraft.current.options);
      setOptionFlags(candidateDraft.current.optionFlags);
    }
    setOutcomeType(nextType);
  }

  const choices = options
    .map((label, index) => ({ label: label.trim(), flagCode: optionFlags[index] ?? "" }))
    .filter((choice) => choice.label);
  const validClose = Boolean(closeTime) && new Date(closeTime).getTime() > Date.now();
  const valid = question.trim().length >= 3 && choices.length >= 2 && validClose;
  const hint = question.trim().length < 3
    ? "Enter a question (at least 3 characters)."
    : choices.length < 2
      ? "Add at least 2 outcomes."
      : !validClose
        ? "Choose a closing date and time in the future."
        : "";

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    try {
      const response = await fetch(marketId ? `/api/markets/${marketId}` : "/api/markets", {
        method: marketId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question.trim(),
          category,
          options: choices.map((choice) => choice.label),
          optionFlags: choices.map((choice) => choice.flagCode),
          closeTime,
          bannerUrl,
          pageantId: initial?.pageantId ?? null,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) onSaved();
      else onError(messageFor(data.error, editing ? "Could not update this market." : "Could not create market."));
    } catch {
      onError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card-gold space-y-3 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="tracking-tight text-xl font-semibold text-[#23252f]">{editing ? "Edit your market" : "Create a market"}</h3>
          {editing && <p className="mt-1 text-xs leading-relaxed text-[#7a7768]">Edits are allowed only before the first position. Saving replaces the empty on-chain market so its public terms stay accurate.</p>}
        </div>
        {onCancel && (
          <button type="button" onClick={onCancel} aria-label="Close market editor" className="shrink-0 rounded-lg border border-[#e7e2d3] p-2 text-[#7a7768] hover:text-[#23252f]">
            <Icons.X size={16} strokeWidth={2} />
          </button>
        )}
      </div>

      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold text-[#5f6172]">Market question</span>
        <input className="field !text-base sm:!text-sm" maxLength={300} placeholder="Who wins the Q&A round?" value={question} onChange={(event) => setQuestion(event.target.value)} />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold text-[#5f6172]">Category</span>
        <select className="field !text-base sm:!text-sm" value={category} onChange={(event) => setCategory(event.target.value)}>
          {MARKET_CATEGORIES.map((segment) => <option key={segment.key} value={segment.key}>{segment.label}</option>)}
        </select>
      </label>

      <fieldset>
        <legend className="mb-1.5 text-xs font-semibold text-[#5f6172]">Outcome type</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            aria-pressed={outcomeType === "candidates"}
            onClick={() => changeOutcomeType("candidates")}
            className={`min-h-[64px] rounded-xl border px-4 py-3 text-left transition ${outcomeType === "candidates" ? "border-[#b88916] bg-[#fff8df] ring-1 ring-[#d4af37]" : "border-[#e7e2d3] bg-white hover:border-[#d9c98f]"}`}
          >
            <span className="block text-sm font-semibold text-[#23252f]">Candidate choices</span>
            <span className="mt-0.5 block text-xs text-[#7a7768]">Names, countries and optional flags</span>
          </button>
          <button
            type="button"
            aria-pressed={outcomeType === "binary"}
            onClick={() => changeOutcomeType("binary")}
            className={`min-h-[64px] rounded-xl border px-4 py-3 text-left transition ${outcomeType === "binary" ? "border-[#b88916] bg-[#fff8df] ring-1 ring-[#d4af37]" : "border-[#e7e2d3] bg-white hover:border-[#d9c98f]"}`}
          >
            <span className="block text-sm font-semibold text-[#23252f]">Yes or No</span>
            <span className="mt-0.5 block text-xs text-[#7a7768]">For questions such as “Will Miss X win?”</span>
          </button>
        </div>
      </fieldset>

      {outcomeType === "candidates" ? (
        <MarketOutcomesField options={options} optionFlags={optionFlags} onChange={setOutcomes} />
      ) : (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-[#5f6172]">Outcomes</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="field flex min-h-[48px] items-center gap-2 !py-2 text-sm font-semibold text-emerald-700"><span className="text-base" aria-hidden>✓</span> Yes</div>
            <div className="field flex min-h-[48px] items-center gap-2 !py-2 text-sm font-semibold text-rose-700"><span className="text-base" aria-hidden>✕</span> No</div>
          </div>
          <p className="text-[11px] leading-relaxed text-[#9a968b]">This market will use exactly two outcomes. Candidate uploads and country flags are not needed.</p>
        </div>
      )}

      <MarketCloseField value={closeTime} onChange={setCloseTime} />
      <BannerUpload value={bannerUrl} onUploaded={setBannerUrl} />
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-gold min-h-[44px] w-full sm:w-fit" disabled={!valid || busy} onClick={submit}>
          {busy ? (editing ? "Saving securely…" : "Creating…") : (editing ? "Save market changes" : "Create market")}
        </button>
        {!valid && !busy && <span className="text-xs text-[#9a968b]">{hint}</span>}
      </div>
    </div>
  );
}
