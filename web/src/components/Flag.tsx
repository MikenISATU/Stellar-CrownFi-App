"use client";

// Real SVG country flags (local, on-demand) — renders correctly on Windows too,
// unlike emoji flags. `sash` is an ISO-2 country code (e.g. "PH"). Files in /public/flags.
export function Flag({ sash, className = "" }: { sash?: string | null; className?: string }) {
  const cc = (sash ?? "").trim().toLowerCase();
  if (cc.length !== 2) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/flags/${cc}.svg`}
      alt={sash ?? ""}
      className={`inline-block h-[0.85em] w-[1.15em] shrink-0 rounded-[2px] object-cover align-[-0.1em] ring-1 ring-black/10 ${className}`}
      loading="lazy"
      onError={(e) => { e.currentTarget.style.display = "none"; }}
    />
  );
}
