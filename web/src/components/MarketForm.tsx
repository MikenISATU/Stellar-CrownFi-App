"use client";

import { useState } from "react";
import { BannerUpload } from "@/components/BannerUpload";
import { Icons } from "@/components/icons";
import { MarketCloseField } from "@/components/MarketCloseField";
import { MarketOutcomesField } from "@/components/MarketOutcomesField";
import { MARKET_CATEGORIES } from "@/lib/segments";
import { messageFor } from "@/lib/messages";

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

export function MarketForm({ marketId, initial, onSaved, onCancel, onError }: Props) {
  const editing = Boolean(marketId);
  const [question, setQuestion] = useState(initial?.question ?? "");
  const [category, setCategory] = useState(initial?.category ?? MARKET_CATEGORIES[0].key);
  const [options, setOptions] = useState<string[]>(initial?.options.map((option) => option.label) ?? ["", ""]);
  const [optionFlags, setOptionFlags] = useState<string[]>(initial?.options.map((option) => option.flagCode ?? "") ?? ["", ""]);
  const [closeTime, setCloseTime] = useState(initial?.closeTime ?? new Date(Date.now() + 72 * 3_600_000).toISOString());
  const [bannerUrl, setBannerUrl] = useState<string | null>(initial?.bannerUrl ?? null);
  const [busy, setBusy] = useState(false);

  const setOutcomes = (nextOptions: string[], nextFlags: string[]) => {
    setOptions(nextOptions);
    setOptionFlags(nextFlags);
  };

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

      <MarketOutcomesField options={options} optionFlags={optionFlags} onChange={setOutcomes} />

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
