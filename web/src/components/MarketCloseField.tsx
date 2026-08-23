"use client";
import { useState } from "react";

// When predictions lock. A market must close before it can be resolved, so instead of a
// raw date picker we offer friendly presets (never leaves the field empty / blocking the
// submit) plus an optional custom date for power users. Emits an ISO string via onChange.
const PRESETS: { label: string; hours: number }[] = [
  { label: "24 hours", hours: 24 },
  { label: "3 days", hours: 72 },
  { label: "1 week", hours: 168 },
  { label: "2 weeks", hours: 336 },
];

function isoFromHours(hours: number): string {
  return new Date(Date.now() + hours * 3_600_000).toISOString();
}

// Format an ISO string for a datetime-local input (local time, no seconds/zone).
function toLocalInput(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const off = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

export function MarketCloseField({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const [preset, setPreset] = useState<number | "custom">(72);

  function choose(hours: number) {
    setPreset(hours);
    onChange(isoFromHours(hours));
  }

  return (
    <div>
      <div className="mb-1.5 text-xs font-semibold text-[#5f6172]">Predictions lock in</div>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.hours}
            type="button"
            onClick={() => choose(p.hours)}
            className={`rounded-full px-3.5 py-1.5 text-sm transition ${preset === p.hours ? "bg-gradient-to-b from-[#d4af37] to-[#b8912f] text-[#1a1f35]" : "border border-[#e7e2d3] bg-white text-[#5f6172] hover:border-[#c9a227]"}`}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setPreset("custom")}
          className={`rounded-full px-3.5 py-1.5 text-sm transition ${preset === "custom" ? "bg-[#23252f] text-white" : "border border-[#e7e2d3] bg-white text-[#5f6172] hover:border-[#c9a227]"}`}
        >
          Custom
        </button>
      </div>
      {preset === "custom" && (
        <input
          className="field mt-2"
          type="datetime-local"
          value={toLocalInput(value)}
          onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : "")}
        />
      )}
    </div>
  );
}
