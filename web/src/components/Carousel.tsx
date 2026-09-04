"use client";
import { useEffect, useRef, useState } from "react";
import { Icons } from "./icons";
import { Portrait } from "./Portrait";
import { Flag } from "./Flag";

export type Slide = {
  id: string; name: string; country: string; sash: string;
  portraitUrl?: string | null; fallbackUrl?: string | null;
  /** Live standing shown on the focused card (votes, rank, share of the round). */
  meta?: { votes: number; rank: number; pct: number };
  profileHref?: string;
};

// The signature element: a pageant "spotlight" carousel. The centered card is lit and raised,
// neighbors dim, evoking a stage spotlight sweeping across contestants. Auto-advances, and is
// swipeable via scroll-snap on touch. Respects reduced-motion.
export function SpotlightCarousel({
  slides,
  onSelect,
  selectedId,
  votedId,
  cta = "Select",
  ariaLabel = "Candidates",
}: {
  slides: Slide[];
  onSelect?: (id: string) => void;
  selectedId?: string;
  /** Locked-in choice (e.g. a vote already cast by this wallet) — shown as Voted, not re-pickable. */
  votedId?: string;
  cta?: string;
  ariaLabel?: string;
}) {
  const [active, setActive] = useState(0);
  const paused = useRef(false);

  useEffect(() => {
    if (!slides.length) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const t = setInterval(() => {
      if (!paused.current) setActive((a) => (a + 1) % slides.length);
    }, 3500);
    return () => clearInterval(t);
  }, [slides.length]);

  if (!slides.length) return <div className="glass p-8 text-center text-[#7a7768]">No contestants yet.</div>;

  const go = (d: number) => setActive((a) => (a + d + slides.length) % slides.length);

  return (
    <div
      className="relative"
      role="region"
      aria-roledescription="carousel"
      aria-label={ariaLabel}
      tabIndex={0}
      onKeyUp={(e) => { if (e.key === "ArrowLeft") go(-1); if (e.key === "ArrowRight") go(1); }}
      onMouseEnter={() => (paused.current = true)}
      onMouseLeave={() => (paused.current = false)}
    >
      <div className="flex items-center justify-center gap-3 sm:gap-5">
        {slides.map((s, i) => {
          const offset = i - active;
          const norm = ((offset + slides.length + Math.floor(slides.length / 2)) % slides.length) - Math.floor(slides.length / 2);
          const isCenter = i === active;
          const isVoted = votedId === s.id;
          // Show exactly 3 (center + one on each side) on desktop; just the center on mobile.
          const hide = Math.abs(norm) > 1;
          const hideOnMobile = Math.abs(norm) > 0;
          return (
            <div
              key={s.id}
              role="button"
              tabIndex={hide || hideOnMobile ? -1 : 0}
              onClick={() => (isCenter ? onSelect?.(s.id) : setActive(i))}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); isCenter ? onSelect?.(s.id) : setActive(i); } }}
              aria-label={isCenter ? `${cta} ${s.name}` : `Focus ${s.name}`}
              className={[
                "shrink-0 cursor-pointer transition-all duration-500 ease-out",
                isCenter ? "w-72 sm:w-96" : "w-44 opacity-55 sm:w-60",
                hide ? "hidden" : "",
                hideOnMobile ? "hidden sm:block" : "",
              ].join(" ")}
              style={{ transform: `scale(${isCenter ? 1 : 0.82})` }}
            >
              <div className={`glass relative overflow-hidden p-2 ${isCenter ? "shadow-spot" : ""} ${isVoted ? "ring-2 ring-[#0f6e56]" : selectedId === s.id ? "ring-2 ring-gold" : ""}`}>
                {isVoted && <span className="tag-on absolute right-2 top-2 z-10">Voted</span>}
                {isCenter && (
                  <>
                    <span className="pointer-events-none absolute left-1 top-1 z-10 h-5 w-5 border-l-2 border-t-2 border-[#c8a233]" />
                    <span className="pointer-events-none absolute right-1 top-1 z-10 h-5 w-5 border-r-2 border-t-2 border-[#c8a233]" />
                    <span className="pointer-events-none absolute bottom-1 left-1 z-10 h-5 w-5 border-b-2 border-l-2 border-[#c8a233]" />
                    <span className="pointer-events-none absolute bottom-1 right-1 z-10 h-5 w-5 border-b-2 border-r-2 border-[#c8a233]" />
                  </>
                )}
                <Portrait id={s.id} name={s.name} sash={s.sash} portraitUrl={s.portraitUrl} fallbackUrl={s.fallbackUrl} />
                <div className="px-1 pb-1 pt-3 text-center">
                  <div className="truncate font-display text-lg font-semibold text-[#23252f]">{s.name}</div>
                  <div className="flex items-center justify-center gap-1.5 text-xs text-[#6f6c5f]"><Flag sash={s.sash} /> {s.country}</div>
                  {isCenter && s.meta && (
                    <div className="mt-2">
                      <div className="flex items-center justify-center gap-2 text-[11px] text-[#7a7768]">
                        <span className="rounded-full bg-[#faf0d2] px-2 py-0.5 font-semibold text-[#8a6d1f]">#{s.meta.rank}</span>
                        <span className="tabular-nums"><b className="text-[#b8912f]">{s.meta.votes.toLocaleString()}</b> votes · {s.meta.pct}%</span>
                      </div>
                      <div className="mx-auto mt-1.5 h-1 w-3/4 overflow-hidden rounded-full bg-[#efe9d8]">
                        <div className="h-full rounded-full bg-gradient-to-r from-[#d4af37] to-[#b8912f] transition-all duration-500" style={{ width: `${s.meta.pct}%` }} />
                      </div>
                    </div>
                  )}
                  {isCenter && (
                    <div className="mt-3 flex flex-col gap-2 px-3 sm:flex-row sm:items-center sm:justify-center">
                      {s.profileHref && (
                        <a href={s.profileHref} onClick={(e) => e.stopPropagation()} className="btn-ghost min-h-[40px] w-full !px-4 !py-2 !text-xs sm:w-auto">View profile</a>
                      )}
                      <span className="btn-gold min-h-[40px] w-full !px-4 !py-2 !text-xs sm:w-auto">
                        {isVoted ? "Voted" : selectedId === s.id ? "Selected" : cta}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex items-center justify-center gap-3">
        <button onClick={() => go(-1)} className="btn-ghost h-9 w-9 !px-0" aria-label="Previous"><Icons.Prev size={16} strokeWidth={2} /></button>
        <div className="flex gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              aria-label={`Go to ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${i === active ? "w-6 bg-gold" : "w-1.5 bg-white/25"}`}
            />
          ))}
        </div>
        <button onClick={() => go(1)} className="btn-ghost h-9 w-9 !px-0" aria-label="Next"><Icons.Next size={16} strokeWidth={2} /></button>
      </div>
    </div>
  );
}
