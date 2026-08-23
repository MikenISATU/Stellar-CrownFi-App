"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icons } from "./icons";

/**
 * Continuously looping horizontal carousel.
 *
 * Ported from the reference implementation, which rotated the DOM directly (moving the last
 * node to the front and back again). React owns the DOM here, so we rotate an array of indices
 * instead and let React re-render — same endless left/right movement, no start and no end,
 * without fighting the reconciler.
 *
 * Behaviour kept from the reference: auto-advance every 3s, and the first user interaction
 * stops the auto-advance for good rather than resuming it a moment later.
 *
 * The outermost card on each side is blurred back so the centre reads as the focus. On mobile
 * only three cards fit, so the blur moves inward to whichever cards are then on the edges.
 */
export function LoopCarousel<T extends { id: string }>({
  items,
  render,
  autoMs = 3000,
  ariaLabel = "Carousel",
  emptyText = "Nothing here yet.",
}: {
  items: T[];
  render: (item: T, state: { center: boolean; edge: boolean }) => React.ReactNode;
  autoMs?: number;
  ariaLabel?: string;
  emptyText?: string;
}) {
  const [order, setOrder] = useState<number[]>(() => items.map((_, i) => i));
  const [auto, setAuto] = useState(true);
  const paused = useRef(false);

  // Rebuild the rotation when the item count changes (data arriving, a filter applied).
  useEffect(() => { setOrder(items.map((_, i) => i)); }, [items.length]);

  const next = useCallback(() => setOrder((o) => (o.length > 1 ? [...o.slice(1), o[0]] : o)), []);
  const prev = useCallback(() => setOrder((o) => (o.length > 1 ? [o[o.length - 1], ...o.slice(0, -1)] : o)), []);

  useEffect(() => {
    if (!auto || items.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => { if (!paused.current) next(); }, autoMs);
    return () => clearInterval(t);
  }, [auto, items.length, autoMs, next]);

  const stopAuto = () => setAuto(false);
  const goNext = () => { stopAuto(); next(); };
  const goPrev = () => { stopAuto(); prev(); };

  if (!items.length) return <div className="glass p-8 text-center text-[#7a7768]">{emptyText}</div>;

  // Five slots on desktop; the outer two are hidden on mobile, leaving three.
  const WINDOW = Math.min(5, items.length);
  const CENTER = Math.floor(WINDOW / 2);
  const window_ = order.slice(0, WINDOW);

  return (
    <div
      className="relative"
      role="region"
      aria-roledescription="carousel"
      aria-label={ariaLabel}
      tabIndex={0}
      onMouseEnter={() => (paused.current = true)}
      onMouseLeave={() => (paused.current = false)}
      onKeyUp={(e) => {
        if (e.key === "ArrowLeft") goPrev();
        if (e.key === "ArrowRight") goNext();
      }}
    >
      {/* Full-bleed: the strip is wider than the page container, so it breaks out to the
          viewport rather than having its outer cards sliced off by the container edge. */}
      <div className="relative left-1/2 w-screen -translate-x-1/2 overflow-hidden px-4">
        <div className="flex items-center justify-center gap-3 sm:gap-5">
        {window_.map((itemIdx, pos) => {
          const item = items[itemIdx];
          if (!item) return null;
          const center = pos === CENTER;
          const outer = pos === 0 || pos === WINDOW - 1;      // far edges (desktop)
          const inner = pos === CENTER - 1 || pos === CENTER + 1; // edges once mobile hides the outer pair

          return (
            <div
              key={item.id}
              onClick={() => { if (!center) { stopAuto(); pos < CENTER ? prev() : next(); } }}
              className={[
                // Note: `scale` below is visual only — these widths are what actually has to fit.
                "shrink-0 transition-all duration-500 ease-out",
                center ? "w-72 sm:w-80" : "w-44 sm:w-52",
                center ? "" : "cursor-pointer",
                // Far cards: blurred and hidden on small screens.
                outer && WINDOW === 5 ? "hidden blur-[3px] opacity-60 sm:block" : "",
                // Neighbours: sharp on desktop, blurred on mobile where they become the edges.
                inner ? "blur-[2px] opacity-80 sm:blur-none sm:opacity-90" : "",
              ].join(" ")}
              style={{ transform: `scale(${center ? 1 : 0.88})` }}
            >
              {render(item, { center, edge: outer })}
            </div>
          );
        })}
        </div>
      </div>

      <div className="mt-6 flex items-center justify-center gap-3">
        <button onClick={goPrev} className="btn-ghost h-9 w-9 !px-0" aria-label="Previous"><Icons.Prev size={16} strokeWidth={2} /></button>
        <button onClick={goNext} className="btn-ghost h-9 w-9 !px-0" aria-label="Next"><Icons.Next size={16} strokeWidth={2} /></button>
      </div>
    </div>
  );
}
