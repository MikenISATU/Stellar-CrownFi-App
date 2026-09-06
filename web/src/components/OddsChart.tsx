"use client";

import { OutcomeMarker } from "@/components/OutcomeMarker";

// Polymarket-style odds chart: one line per option showing its implied probability (% of the
// pool) over time, reconstructed from the market's stake history. Pure inline SVG (no deps).
type Point = { t: number; pcts: number[] };
type ChartOption = { label: string; flagCode?: string | null };

const LARGE_MARKET_THRESHOLD = 12;
const MAX_LARGE_MARKET_LINES = 8;

// Short axis label, e.g. "Jul 12, 9:04 PM".
function fmtTime(ms: number): string {
  const d = new Date(ms);
  return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}, ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}

export function OddsChart({ series, options, colors }: { series: Point[]; options: ChartOption[]; colors: string[] }) {
  const W = 520, H = 180, PAD_L = 30, PAD_B = 18, PAD_T = 8, PAD_R = 8;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  if (!series || series.length < 2) {
    return (
      <div className="grid h-40 place-items-center rounded-xl border border-dashed border-[#e7e2d3] text-xs text-[#9a968b]">
        The odds chart appears once there are a few predictions.
      </div>
    );
  }

  const xAt = (i: number) => PAD_L + (series.length === 1 ? 0 : (i / (series.length - 1)) * plotW);
  const yAt = (pct: number) => PAD_T + (1 - pct / 100) * plotH;
  const last = series[series.length - 1].pcts;
  const largeMarket = options.length > LARGE_MARKET_THRESHOLD;
  const rankedIndexes = options
    .map((_, index) => ({
      index,
      current: last[index] ?? 0,
      peak: Math.max(...series.map((point) => point.pcts[index] ?? 0)),
    }))
    .filter((option) => !largeMarket || option.peak > 0)
    .sort((a, b) => largeMarket ? b.current - a.current || b.peak - a.peak || a.index - b.index : a.index - b.index);
  const visibleIndexes = largeMarket ? rankedIndexes.slice(0, MAX_LARGE_MARKET_LINES) : rankedIndexes;
  const paths = visibleIndexes.map(({ index }) =>
    series.map((point, pointIndex) => `${pointIndex === 0 ? "M" : "L"} ${xAt(pointIndex).toFixed(1)} ${yAt(point.pcts[index] ?? 0).toFixed(1)}`).join(" ")
  );

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Odds over time">
        {/* horizontal gridlines at 0/25/50/75/100% */}
        {[0, 25, 50, 75, 100].map((g) => (
          <g key={g}>
            <line x1={PAD_L} x2={W - PAD_R} y1={yAt(g)} y2={yAt(g)} stroke="currentColor" className="text-[#eee6d3]" strokeWidth={1} />
            <text x={PAD_L - 5} y={yAt(g) + 3} textAnchor="end" className="fill-[#9a968b]" fontSize={9}>{g}</text>
          </g>
        ))}
        {paths.map((d, displayIndex) => {
          const optionIndex = visibleIndexes[displayIndex].index;
          return (
            <path key={optionIndex} d={d} fill="none" stroke={colors[displayIndex % colors.length]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round">
              <title>{options[optionIndex].label}: {last[optionIndex] ?? 0}%</title>
            </path>
          );
        })}
      </svg>
      <div className="mt-0.5 flex justify-between px-[30px] text-[10px] text-[#9a968b]">
        <span>{fmtTime(series[0].t)}</span>
        <span>{fmtTime(series[series.length - 1].t)}</span>
      </div>
      {largeMarket && (
        <div className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-[#9a968b]">
          {visibleIndexes.length > 0 ? `Showing ${visibleIndexes.length} active outcome${visibleIndexes.length === 1 ? "" : "s"}` : "No active outcomes yet"}
          {rankedIndexes.length > MAX_LARGE_MARKET_LINES ? ` · top ${MAX_LARGE_MARKET_LINES}` : ""}
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-[#7a7768]">
        {visibleIndexes.map(({ index: optionIndex }, displayIndex) => {
          const option = options[optionIndex];
          const percentage = last[optionIndex] ?? 0;
          return (
            <span
              key={optionIndex}
              title={`${option.label}: ${percentage}%`}
              aria-label={`${option.label}: ${percentage}%`}
              className={largeMarket ? "inline-flex min-h-8 items-center gap-1.5 rounded-full border border-[#e7e2d3] bg-white px-2.5 py-1" : "flex items-center gap-1"}
            >
              <span className="inline-block h-2 w-2 rounded-sm" style={{ background: colors[displayIndex % colors.length] }} />
              {largeMarket && <OutcomeMarker label={option.label} flagCode={option.flagCode} className="!h-3.5 !w-5" />}
              {!largeMarket && <span>{option.label}</span>}
              <span className="font-semibold tabular-nums text-[#5f6172]">{percentage}%</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
