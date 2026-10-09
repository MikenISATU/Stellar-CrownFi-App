"use client";
import Link from "next/link";
import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { MarketView } from "@/components/MarketCard";
import { categoryImage } from "@/lib/segments";

export function LiveMarketPreview({ markets }: { markets: MarketView[] }) {
  const viewport = useRef<HTMLDivElement>(null);
  const direction = useRef(1);
  const [paused, setPaused] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const [now, setNow] = useState(Date.now());
  const live = markets.filter((m) => m.status === "open" && new Date(m.closeTime).getTime() > now);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 15_000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    if (paused || interacting || live.length < 3) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const timer = setInterval(() => {
      const el = viewport.current;
      if (!el || el.matches(":focus-within") || media.matches || document.visibilityState !== "visible") return;
      const max = el.scrollHeight - el.clientHeight;
      if (max <= 0) return;
      if (el.scrollTop >= max - 2) direction.current = -1;
      if (el.scrollTop <= 2) direction.current = 1;
      el.scrollBy({ top: direction.current * 124, behavior: "smooth" });
    }, 3200);
    return () => clearInterval(timer);
  }, [paused, interacting, live.length]);
  return <section className="min-w-0 rounded-2xl border border-[#e6d9ad] bg-[#fffaf0] p-4 sm:p-5" aria-label="Live prediction market preview">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="font-display text-xl font-semibold">Live predictions</h3>{live.length > 2 && <button type="button" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#d9c98f]" aria-label={paused ? "Resume preview" : "Pause preview"} title={paused ? "Resume preview" : "Pause preview"} onClick={() => setPaused((p) => !p)}>{paused ? <Play size={18} aria-hidden="true" /> : <Pause size={18} aria-hidden="true" />}</button>}</div>
    {live.length ? <div ref={viewport} tabIndex={0} aria-label="Live markets. Scroll to browse." className="max-h-[296px] space-y-3 overflow-y-auto overscroll-contain rounded-xl motion-reduce:scroll-auto"
      onMouseEnter={() => setInteracting(true)} onMouseLeave={() => setInteracting(false)} onFocusCapture={() => setInteracting(true)} onBlurCapture={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setInteracting(false); }} onTouchStart={() => setPaused(true)}>
      {live.map((m) => <Link key={m.id} href={`/predictions/${m.id}`} className="flex h-28 min-w-0 items-center gap-3 rounded-xl border border-[#e6d9ad] bg-white p-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#a97f16]">
        <div aria-hidden="true" className="h-16 w-16 shrink-0 rounded-lg bg-[#eee6d3] bg-cover bg-center" style={{ backgroundImage: `url(${JSON.stringify(m.bannerUrl || categoryImage(m.category))})` }} />
        <div className="min-w-0"><span className="text-xs font-semibold text-emerald-700">● Live</span><div className="line-clamp-2 text-sm font-semibold text-[#23252f]">{m.question}</div><div className="mt-1 text-xs text-[#7a7768]">{m.totalPool.toLocaleString()} test USDC · {m.participants} predicting</div></div>
      </Link>)}
    </div> : <p className="rounded-xl bg-white p-5 text-sm text-[#7a7768]">No live predictions right now. Check the markets for upcoming events.</p>}
    <Link href="/predictions" className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-[#8a6d1f]">Browse all prediction markets →</Link>
  </section>;
}
