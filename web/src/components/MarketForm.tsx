"use client";

import { useState } from "react";
import { BannerUpload } from "@/components/BannerUpload";
import { Flag } from "@/components/Flag";
import { Icons } from "@/components/icons";
import { MarketCloseField } from "@/components/MarketCloseField";
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

  const setOption = (i: number, value: string) => setOptions((prev) => prev.map((option, index) => (index === i ? value : option)));
  const setOptionFlag = (i: number, value: string) => setOptionFlags((prev) => prev.map((code, index) => (
    index === i ? value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2) : code
  )));
  const addOption = () => {
    setOptions((prev) => (prev.length < 32 ? [...prev, ""] : prev));
    setOptionFlags((prev) => (prev.length < 32 ? [...prev, ""] : prev));
  };
  const removeOption = (i: number) => {
    setOptions((prev) => prev.filter((_, index) => index !== i));
    setOptionFlags((prev) => prev.filter((_, index) => index !== i));
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

      <div className="space-y-2">
        <div className="text-xs font-semibold text-[#5f6172]">Outcomes <span className="font-normal text-[#9a968b]">· optional 2-letter country code adds its flag</span></div>
        {options.map((option, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-5 shrink-0 text-right text-xs tabular-nums text-[#9a968b]">{i + 1}</span>
            <input className="field min-w-0 !text-base sm:!text-sm" maxLength={120} placeholder={`Outcome ${i + 1}`} value={option} onChange={(event) => setOption(i, event.target.value)} />
            <label className="relative flex w-[4.25rem] shrink-0 items-center sm:w-[4.75rem]">
              <span className="pointer-events-none absolute left-2.5 z-10 flex h-4 w-6 items-center justify-center"><Flag sash={optionFlags[i]} className="!h-4 !w-6" /></span>
              <input className="field !pl-10 !pr-2 uppercase" aria-label={`Country code for outcome ${i + 1}`} title="Optional ISO country code, such as PH" maxLength={2} placeholder="Flag" value={optionFlags[i]} onChange={(event) => setOptionFlag(i, event.target.value)} />
            </label>
            {options.length > 2 && (
              <button type="button" onClick={() => removeOption(i)} aria-label={`Remove outcome ${i + 1}`} className="shrink-0 rounded-lg border border-[#e7e2d3] p-2 text-[#9a968b] transition hover:border-[#e7d0d0] hover:text-[#9f1239]">
                <Icons.X size={14} strokeWidth={2} />
              </button>
            )}
          </div>
        ))}
        {options.length < 32 && <button type="button" onClick={addOption} className="min-h-[44px] text-sm font-semibold text-[#a97f16] hover:underline">+ Add outcome</button>}
      </div>

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
