"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Portrait } from "@/components/Portrait";
import { Flag } from "@/components/Flag";
import { getJson } from "@/lib/api";

type Winner = {
  category: string; label: string; roundTitle: string;
  name: string; country: string; sash: string; contestantId: string;
  portraitUrl: string | null; votes: number; totalVotes: number;
  anchorTx: string | null; merkleRoot: string;
};
type Feed = { announced: boolean; winners: Winner[] };

const slugOf = (w: Winner) => String(w.country || w.sash).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// The coronation page. Three beats, each behind a click — the curtain (looping reel),
// the crown (overall winner), then the full court (stage winners). Every result shown
// here comes from an anchored tally, with the anchor transaction linked beneath it.
export default function WinnersPage() {
  const [feed, setFeed] = useState<Feed | null>(null);
  // 0 = curtain · 1 = the crown · 2 = everything
  const [act, setAct] = useState(0);

  useEffect(() => { getJson<Feed | null>("/api/winners", null).then(setFeed); }, []);

  const overall = feed?.winners.find((w) => w.category === "overall") ?? null;
  const stages = feed?.winners.filter((w) => w.category !== "overall") ?? [];

  // ── Curtain (also the "not yet" teaser) ─────────────────────────────
  if (!feed || !feed.announced || act === 0) {
    const ready = Boolean(feed?.announced && feed.winners.length > 0);
    return (
      <div className="mx-auto max-w-3xl">
        <section className="group relative overflow-hidden rounded-[2rem] border border-[#e7d9a8] shadow-[0_30px_70px_-42px_rgba(184,145,47,0.85)]">
          <div className="sfl-band absolute inset-0" />
          <div className="relative flex flex-col items-center px-6 py-12 text-center sm:py-16">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/sfl.gif" alt="" className="h-44 w-auto max-w-full object-contain sm:h-64" />
            <div className="eyebrow mt-6">Coronation Night 2026</div>
            <h1 className="mt-2 tracking-tight text-4xl font-semibold text-[#23252f] sm:text-5xl">
              {ready ? <>The results are <span className="font-display italic text-[#c8a233]">in</span></> : <>The <span className="font-display italic text-[#c8a233]">crown</span> awaits</>}
            </h1>
            <p className="mt-3 max-w-md text-sm text-[#5f6172]">
              {ready
                ? "Every result below was sealed on Stellar the moment its round closed — decided before it was announced."
                : "Winners are announced after Coronation Night. Every tally is already sealed on Stellar the moment its round closes."}
            </p>
            {ready ? (
              <button className="btn-gold mt-7 !px-10 !py-3 text-base" onClick={() => setAct(1)}>Reveal the crown</button>
            ) : (
              <div className="mt-7 flex flex-wrap justify-center gap-3">
                <Link href="/vote" className="btn-gold !px-8 !py-3">Cast your vote</Link>
                <Link href="/leaderboard" className="btn-ghost !px-7 !py-3">Live standings</Link>
              </div>
            )}
          </div>
          <div className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 animate-sheen bg-gradient-to-r from-transparent via-white/40 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#d4af37] to-transparent" />
        </section>
      </div>
    );
  }

  // ── The crown, then the court ───────────────────────────────────────
  const crown = overall ?? stages[0] ?? null;
  const court = overall ? stages : stages.slice(1);

  return (
    <div className="mx-auto max-w-4xl space-y-10">
      {crown && (
        <section className="animate-fadeSlideUp text-center">
          <div className="eyebrow">Coronation Night 2026</div>
          <h1 className="mt-1 tracking-tight text-4xl font-semibold text-[#23252f] sm:text-5xl">
            {overall ? <>Your Official <span className="font-display italic text-[#c8a233]">Winner</span></> : crown.label}
          </h1>

          <div className="card-gold mx-auto mt-6 max-w-sm p-4">
            <div className="overflow-hidden rounded-xl">
              <Portrait
                id={crown.contestantId}
                name={crown.name}
                sash={crown.sash}
                portraitUrl={overall ? crown.portraitUrl : `/candidates/${crown.category}/${slugOf(crown)}.webp`}
                fallbackUrl={crown.portraitUrl}
              />
            </div>
            <div className="pt-4 text-center">
              <div className="font-display text-3xl font-semibold text-[#b8912f]">{crown.name}</div>
              <div className="mt-1 flex items-center justify-center gap-1.5 text-sm text-[#6f6c5f]"><Flag sash={crown.sash} /> {crown.country}</div>
              <div className="mt-2 text-xs text-[#7a7768]">{crown.votes} of {crown.totalVotes} sealed votes · {crown.roundTitle}</div>
              {crown.anchorTx && (
                <a href={`https://stellar.expert/explorer/testnet/tx/${crown.anchorTx}`} target="_blank" rel="noopener noreferrer"
                  className="mt-3 inline-block text-xs font-semibold text-[#a97f16] hover:underline">
                  Sealed on Stellar — view the anchor ↗
                </a>
              )}
            </div>
          </div>

          {act === 1 && court.length > 0 && (
            <button className="btn-gold mt-8 !px-8 !py-3" onClick={() => setAct(2)}>Reveal the stage winners</button>
          )}
        </section>
      )}

      {act === 2 && court.length > 0 && (
        <section>
          <h2 className="mb-5 text-center tracking-tight text-2xl font-semibold text-[#23252f]">Stage winners</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {court.map((w, i) => (
              <div key={w.category} className="card-gold animate-fadeSlideUp p-3" style={{ animationDelay: `${i * 120}ms` }}>
                <div className="overflow-hidden rounded-xl">
                  <Portrait
                    id={w.contestantId}
                    name={w.name}
                    sash={w.sash}
                    portraitUrl={`/candidates/${w.category}/${slugOf(w)}.webp`}
                    fallbackUrl={w.portraitUrl}
                  />
                </div>
                <div className="px-1 pb-1 pt-3 text-center">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[#a97f16]">{w.label}</div>
                  <div className="mt-1 font-display text-xl font-semibold text-[#23252f]">{w.name}</div>
                  <div className="mt-0.5 flex items-center justify-center gap-1.5 text-xs text-[#6f6c5f]"><Flag sash={w.sash} /> {w.country}</div>
                  <div className="mt-1.5 text-[11px] text-[#7a7768]">{w.votes} of {w.totalVotes} sealed votes</div>
                  {w.anchorTx && (
                    <a href={`https://stellar.expert/explorer/testnet/tx/${w.anchorTx}`} target="_blank" rel="noopener noreferrer"
                      className="mt-2 inline-block text-[11px] font-semibold text-[#a97f16] hover:underline">
                      View the anchor ↗
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {!crown && (
        <div className="glass p-10 text-center">
          <div className="font-display text-xl text-[#23252f]">No sealed results yet</div>
          <p className="mt-2 text-sm text-[#7a7768]">Winners appear here once rounds are closed and anchored.</p>
        </div>
      )}
    </div>
  );
}
