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

const COMMON_TIMEZONES = [
  "UTC",
  "Asia/Manila",
  "Asia/Singapore",
  "Asia/Bangkok",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Europe/London",
  "Europe/Paris",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Australia/Sydney",
  "Pacific/Auckland",
] as const;

function isoFromHours(hours: number): string {
  return new Date(Date.now() + hours * 3_600_000).toISOString();
}

function partsInZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { year: value("year"), month: value("month"), day: value("day"), hour: value("hour"), minute: value("minute"), second: value("second") };
}

// Format an ISO instant as wall-clock time in the creator's selected zone.
function toZonedInput(iso: string, timeZone: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = partsInZone(d, timeZone);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

// Convert wall-clock time in an IANA timezone to the UTC instant stored by the API.
function isoFromZonedInput(value: string, timeZone: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return "";
  const desired = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]));
  let guess = desired;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const actual = partsInZone(new Date(guess), timeZone);
    const represented = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
    guess += desired - represented;
  }
  return new Date(guess).toISOString();
}

export function MarketCloseField({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const [preset, setPreset] = useState<number | "custom">(72);
  const [timeZone, setTimeZone] = useState<string>("Asia/Manila");

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
        <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_13rem]">
          <label>
            <span className="mb-1 block text-[11px] font-medium text-[#7a7768]">Date & time <span className="font-normal">(MM/DD/YYYY)</span></span>
            <input
              className="field"
              type="datetime-local"
              value={toZonedInput(value, timeZone)}
              onChange={(event) => onChange(event.target.value ? isoFromZonedInput(event.target.value, timeZone) : "")}
            />
          </label>
          <label>
            <span className="mb-1 block text-[11px] font-medium text-[#7a7768]">Timezone</span>
            <select className="field" value={timeZone} onChange={(event) => setTimeZone(event.target.value)}>
              {COMMON_TIMEZONES.map((zone) => <option key={zone} value={zone}>{zone.replaceAll("_", " ")}</option>)}
            </select>
          </label>
        </div>
      )}
    </div>
  );
}
