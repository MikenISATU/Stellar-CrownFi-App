"use client";
import Link from "next/link";
import { CATEGORY_LABEL, categoryImage } from "@/lib/segments";
import { Flag } from "@/components/Flag";

export { CATEGORY_LABEL };

export type MarketView = {
  id: string; pageantId: string | null; category: string; question: string; status: string; live: boolean; official: boolean;
  isCreator: boolean; canManage: boolean; canEdit: boolean; hasPositions: boolean;
  closeTime: string; endsInMs: number; winningOption: number | null; bannerUrl: string | null;
  options: { index: number; label: string; flagCode: string | null; pool: number; percent: number }[];
  totalPool: number; participants: number;
};

export function statusBadge(m: MarketView): { label: string; cls: string } {
  if (m.status === "resolved") return { label: "Resolved", cls: "bg-[#e1f5ee] text-[#0f6e56]" };
  if (m.status === "cancelled") return { label: "Cancelled", cls: "bg-[#fbe9ef] text-[#9f1239]" };
  if (m.live) return { label: "Live", cls: "bg-[#fdeaea] text-[#c0392b]" };
  if (m.status === "open" && m.endsInMs <= 0) return { label: "Closing", cls: "bg-[#faf0d2] text-[#8a6d1f]" };
  return { label: "Upcoming", cls: "bg-[#e6eefb] text-[#2c4a80]" };
}

export function timeLeft(ms: number): string {
  if (ms <= 0) return "Closed";
  const h = Math.floor(ms / 3_600_000);
  if (h >= 24) return `Ends in ${Math.floor(h / 24)}d`;
  if (h >= 1) return `Ends in ${h}h`;
  return `Ends in ${Math.max(1, Math.floor(ms / 60_000))}m`;
}

export function MarketCard({ m }: { m: MarketView }) {
  const badge = statusBadge(m);
  const sorted = [...m.options].sort((a, b) => b.percent - a.percent);
  const top = sorted.slice(0, 2);
  const extra = m.options.length - top.length;
  const resolvedWin = m.status === "resolved" && m.winningOption != null ? m.options.find((o) => o.index === m.winningOption) : null;
  return (
    <Link
      href={`/predictions/${m.id}`}
      className={`glass glass-hover flex flex-col overflow-hidden transition duration-200 active:scale-[0.99] ${m.official ? "ring-2 ring-[#d4af37]/70 shadow-[0_18px_44px_-24px_rgba(184,145,47,0.55)]" : ""}`}
    >
      {/* Banner (uploaded image, or a category-gradient template) */}
      <div className={`relative w-full ${m.official ? "h-28" : "h-24"}`}>
        {/* Gold gradient always behind; the banner (uploaded, or the category default) covers it,
            and hides itself on error so the gradient shows when no image exists. */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#eacb63] via-[#d4af37] to-[#b8912f]" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={m.bannerUrl ?? categoryImage(m.category)} alt="" onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-black/25 to-transparent" />
        <div className="absolute right-2 top-2 flex items-center gap-1.5">
          {m.official
            ? <span className="rounded-full bg-[#1a1f35] px-2 py-0.5 text-[11px] font-semibold text-[#f4e29a]">★ Official</span>
            : <span className="rounded-full bg-white/85 px-2 py-0.5 text-[11px] font-semibold text-[#5f6172]">{m.isCreator ? "Your market" : "Community"}</span>}
          <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge.cls}`}>
            {m.live && <span className="inline-block h-1.5 w-1.5 rounded-full bg-current motion-safe:animate-pulse" />}
            {badge.label}
          </span>
        </div>
        <span className="absolute bottom-2 left-2 rounded-full bg-black/40 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur">{CATEGORY_LABEL[m.category] ?? m.category}</span>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="line-clamp-2 min-h-[2.6rem] font-display text-lg leading-snug text-[#23252f]">{m.question}</div>

        {resolvedWin ? (
          <div className="mt-3 flex flex-1 items-center gap-2 rounded-xl bg-[#f2fbf7] px-3 py-2.5 text-sm text-[#0f6e56]">
            <span aria-hidden>🏆</span> <span className="flex min-w-0 items-center gap-1.5 truncate"><Flag sash={resolvedWin.flagCode} className="!h-3.5 !w-5" /><b className="truncate">{resolvedWin.label}</b> won</span>
          </div>
        ) : (
          <div className="mt-3 flex-1 space-y-2">
            {top.map((o, i) => (
              <div key={o.index}>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex min-w-0 items-center gap-1.5 truncate text-[#5f6172]"><Flag sash={o.flagCode} className="!h-3 !w-[18px]" /><span className="truncate">{o.label}</span></span>
                  <span className={`shrink-0 font-semibold tabular-nums ${i === 0 ? "text-[#a97f16]" : "text-[#9a968b]"}`}>{o.percent}%</span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[#efe9d8]">
                  <div className={`h-full rounded-full ${i === 0 ? "bg-gradient-to-r from-[#d4af37] to-[#b8912f]" : "bg-[#d9d3c3]"}`} style={{ width: `${o.percent}%` }} />
                </div>
              </div>
            ))}
            {extra > 0 && <div className="pt-0.5 text-[11px] text-[#9a968b]">+{extra} more outcome{extra > 1 ? "s" : ""}</div>}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between border-t border-[#eee6d3] pt-3 text-xs text-[#7a7768]">
          <span className="tabular-nums">{m.totalPool.toLocaleString()} USDC · {m.participants} in</span>
          <span className="tabular-nums">{m.status === "resolved" ? "Resolved" : m.status === "cancelled" ? "Cancelled" : timeLeft(m.endsInMs)}</span>
        </div>
      </div>
    </Link>
  );
}
