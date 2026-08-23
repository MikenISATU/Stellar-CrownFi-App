"use client";

// Polymarket-style odds chart: one line per option showing its implied probability (% of the
// pool) over time, reconstructed from the market's stake history. Pure inline SVG (no deps).
type Point = { t: number; pcts: number[] };

// Short axis label, e.g. "Jul 12, 9:04 PM".
function fmtTime(ms: number): string {
  const d = new Date(ms);
  return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}, ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}

export function OddsChart({ series, labels, colors }: { series: Point[]; labels: string[]; colors: string[] }) {
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

  const n = labels.length;
  const xAt = (i: number) => PAD_L + (series.length === 1 ? 0 : (i / (series.length - 1)) * plotW);
  const yAt = (pct: number) => PAD_T + (1 - pct / 100) * plotH;

  const paths = Array.from({ length: n }, (_, opt) =>
    series.map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(1)} ${yAt(p.pcts[opt] ?? 0).toFixed(1)}`).join(" ")
  );
  const last = series[series.length - 1].pcts;

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
        {paths.map((d, opt) => (
          <path key={opt} d={d} fill="none" stroke={colors[opt % colors.length]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        ))}
      </svg>
      <div className="mt-0.5 flex justify-between px-[30px] text-[10px] text-[#9a968b]">
        <span>{fmtTime(series[0].t)}</span>
        <span>{fmtTime(series[series.length - 1].t)}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[#7a7768]">
        {labels.map((l, i) => (
          <span key={i} className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ background: colors[i % colors.length] }} /> {l} {last[i] ?? 0}%
          </span>
        ))}
      </div>
    </div>
  );
}
