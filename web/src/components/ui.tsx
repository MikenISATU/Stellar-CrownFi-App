"use client";
import { useEffect, useRef, useState } from "react";

export function SectionHeading({ eyebrow, title, sub }: { eyebrow?: string; title: string; sub?: string }) {
  return (
    <div className="mb-6">
      {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
      <h2 className="tracking-tight text-3xl font-semibold text-[#23252f] sm:text-4xl">{title}</h2>
      {sub && <p className="mt-2 max-w-2xl text-sm text-[#5f6172]">{sub}</p>}
    </div>
  );
}

export function CountUp({ to, suffix = "" }: { to: number; suffix?: string }) {
  const [n, setN] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useRef(false); // already scrolled into view at least once
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Show the real number without animating when animating isn't possible or wanted:
    // reduced-motion, or a tab that isn't visible (a hidden tab suspends BOTH rAF and
    // IntersectionObserver, so the counter would otherwise sit on 0 showing a wrong figure).
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || document.visibilityState !== "visible") { setN(to); return; }

    let raf = 0;
    let settle: ReturnType<typeof setTimeout>;
    const dur = 1200;
    const run = () => {
      const start = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - start) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        setN(Math.round(to * eased));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      // Browsers pause rAF in background/throttled tabs, which would strand the counter on 0
      // and quietly show the wrong number. Land on the real value regardless.
      settle = setTimeout(() => setN(to), dur + 250);
    };

    // Counters mount with `to` at 0 and get their real value once the fetch lands. If that
    // happens after we were already on screen, animate straight away — otherwise the counter
    // would sit on 0 forever, having "counted up" to nothing.
    if (seen.current) { run(); return () => { cancelAnimationFrame(raf); clearTimeout(settle); }; }

    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !seen.current) { seen.current = true; run(); }
    }, { threshold: 0.4 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); clearTimeout(settle); };
  }, [to]);
  return <span ref={ref}>{n.toLocaleString()}{suffix}</span>;
}

export function Toast({ msg, tone = "ok" }: { msg: string; tone?: "ok" | "err" }) {
  if (!msg) return null;
  return (
    <div className={`fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 animate-floatUp rounded-xl px-4 py-3 text-center text-sm shadow-glass sm:bottom-8 sm:w-auto sm:rounded-full sm:py-2 ${tone === "ok" ? "bg-emerald text-ink" : "bg-ruby text-white"}`}>
      {msg}
    </div>
  );
}
