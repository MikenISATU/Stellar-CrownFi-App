"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icons } from "./icons";
import type { Slide } from "./Carousel";

/**
 * Delegate filmstrip — the accordion carousel from the reference design, in gold.
 *
 * The reference rotated real DOM nodes (remove the first card, append it to the end) and kept
 * `data-active` pinned to a fixed position, so content flows through the open slot. React owns
 * the DOM here, so we rotate an array of indices and pin the active slot the same way — same
 * effect, no nodes yanked out from under the reconciler.
 *
 * Auto-advances every 3s and stops for good on the first interaction, as the reference does.
 */
export function Filmstrip({ slides }: { slides: Slide[] }) {
  const [order, setOrder] = useState<number[]>(() => slides.map((_, i) => i));
  const [auto, setAuto] = useState(true);
  const paused = useRef(false);

  useEffect(() => { setOrder(slides.map((_, i) => i)); }, [slides.length]);

  const next = useCallback(() => setOrder((o) => (o.length > 1 ? [...o.slice(1), o[0]] : o)), []);
  const prev = useCallback(() => setOrder((o) => (o.length > 1 ? [o[o.length - 1], ...o.slice(0, -1)] : o)), []);

  useEffect(() => {
    if (!auto || slides.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => { if (!paused.current) next(); }, 3000);
    return () => clearInterval(t);
  }, [auto, slides.length, next]);

  if (!slides.length) return <div className="glass p-8 text-center text-[#7a7768]">No delegates yet.</div>;

  const stop = () => setAuto(false);
  const goNext = () => { stop(); next(); };
  const goPrev = () => { stop(); prev(); };
  // The open card sits mid-strip; content rotates through it.
  const ACTIVE = Math.min(2, Math.floor(slides.length / 2));

  return (
    <div
      className="filmstrip"
      onMouseEnter={() => (paused.current = true)}
      onMouseLeave={() => (paused.current = false)}
    >
      <ul
        className="filmstrip__list"
        onKeyUp={(e) => {
          if (e.key === "ArrowLeft" || e.key === "a") goPrev();
          if (e.key === "ArrowRight" || e.key === "d") goNext();
        }}
      >
        {order.map((slideIdx, pos) => {
          const s = slides[slideIdx];
          if (!s) return null;
          const active = pos === ACTIVE;
          return (
            <li
              key={s.id}
              className="filmstrip__item"
              data-active={active || undefined}
              tabIndex={0}
              aria-label={s.name}
              // Clicking a resting card walks the strip toward it.
              onClick={() => { if (!active) { stop(); pos < ACTIVE ? prev() : next(); } }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.portraitUrl ?? s.fallbackUrl ?? ""} alt={s.name} loading="lazy" />
              <div className="filmstrip__contents">
                <h3 className="filmstrip__name tracking-tight">{s.name}</h3>
                <p className="filmstrip__country">{s.country}</p>
                {active && (
                  <Link href={`/contestants/${s.id}`} className="filmstrip__cta btn-gold !min-h-[36px] !px-5 !py-1.5 !text-xs">
                    View profile
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex items-center justify-center gap-3">
        <button onClick={goPrev} className="btn-ghost h-9 w-9 !px-0" aria-label="Previous delegate"><Icons.Prev size={16} strokeWidth={2} /></button>
        <button onClick={goNext} className="btn-ghost h-9 w-9 !px-0" aria-label="Next delegate"><Icons.Next size={16} strokeWidth={2} /></button>
      </div>
    </div>
  );
}
