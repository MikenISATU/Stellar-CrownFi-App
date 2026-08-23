"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "@/session/SessionProvider";
import { SpotlightCarousel, Slide } from "@/components/Carousel";
import { Toast } from "@/components/ui";
import { getJson, postJson } from "@/lib/api";
import { Flag } from "@/components/Flag";
import { Icons } from "@/components/icons";
import { messageFor } from "@/lib/messages";
import { PAGEANT_SEGMENTS, CATEGORY_LABEL } from "@/lib/segments";

type Round = { id: string; title: string; status: string; category: string | null };
type TallyRow = { id: string; name: string; sash: string; votes: number };
type Board = { total: number; contestants: TallyRow[] };

export default function VotePage() {
  const { fan, ready } = useSession();
  const [cons, setCons] = useState<any[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [activeCat, setActiveCat] = useState<string>(PAGEANT_SEGMENTS[0].key);
  const [picked, setPicked] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [board, setBoard] = useState<Board | null>(null);
  const [myVotes, setMyVotes] = useState<Record<string, string>>({}); // roundId → contestantId
  const [toast, setToast] = useState<{ msg: string; tone: "ok" | "err" }>({ msg: "", tone: "ok" });

  // The round you vote in = the open round for the selected category (else its latest round).
  const round = useMemo(() => {
    const inCat = rounds.filter((r) => r.category === activeCat);
    return inCat.find((r) => r.status === "open") ?? inCat[0] ?? null;
  }, [rounds, activeCat]);

  // Live standings for THIS stage's round — feeds the cards and the tally below.
  const loadTotals = useCallback(() => {
    const url = round ? `/api/leaderboard?roundId=${round.id}` : "/api/leaderboard";
    getJson<Board | null>(url, null).then((b) => b && setBoard(b));
  }, [round?.id]);

  // votes + rank per candidate, so the carousel can inform the choice, not just display it.
  const voteInfo = useMemo(() => {
    const map = new Map<string, { votes: number; rank: number; pct: number }>();
    const rows = board?.contestants ?? [];
    rows.forEach((r, i) => map.set(r.id, { votes: r.votes, rank: i + 1, pct: board!.total > 0 ? Math.round((r.votes / board!.total) * 100) : 0 }));
    return map;
  }, [board]);

  // Category-specific candidate photos with fallback to the base portrait.
  const slides: Slide[] = useMemo(() => cons.map((c: any) => {
    const slug = String(c.country || c.sash).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const info = voteInfo.get(c.id);
    return {
      id: c.id, name: c.name, country: c.country, sash: c.sash,
      portraitUrl: `/candidates/${activeCat}/${slug}.webp`,
      fallbackUrl: c.portraitUrl ?? `/candidates/${slug}.webp`,
      meta: info ? { votes: info.votes, rank: info.rank, pct: info.pct } : undefined,
      profileHref: `/contestants/${c.id}`,
    };
  }), [cons, activeCat, voteInfo]);

  // What this wallet has already voted for, keyed by round.
  const loadMyVotes = useCallback(async () => {
    if (!fan) { setMyVotes({}); return; }
    const d = await getJson<{ votes: { roundId: string; contestantId: string }[] }>("/api/vote", { votes: [] });
    setMyVotes(Object.fromEntries(d.votes.map((v) => [v.roundId, v.contestantId])));
  }, [fan]);
  useEffect(() => { loadMyVotes(); }, [loadMyVotes]);

  useEffect(() => {
    getJson<any[]>("/api/contestants", [], { ttl: 60_000 }).then(setCons);
    getJson<Round[]>("/api/rounds", [], { ttl: 30_000 }).then(setRounds);
  }, []);

  useEffect(() => {
    loadTotals();
    const iv = setInterval(loadTotals, 8000); // live vote totals for the stage on screen
    return () => clearInterval(iv);
  }, [loadTotals]);

  // Stages this wallet has already voted in (checkmarks on the pills).
  const votedCats = useMemo(() => {
    const set = new Set<string>();
    for (const r of rounds) if (r.category && myVotes[r.id]) set.add(r.category);
    return set;
  }, [rounds, myVotes]);

  const votedFor = round ? myVotes[round.id] ?? "" : "";
  useEffect(() => { setPicked(votedFor); }, [votedFor, activeCat]);

  function flash(msg: string, tone: "ok" | "err") {
    setToast({ msg, tone });
    setTimeout(() => setToast({ msg: "", tone }), 2800);
  }

  async function cast() {
    if (!fan || !round || !picked) return;
    setBusy(true);
    const { ok, data } = await postJson<{ error?: string; pointsAwarded?: number }>("/api/vote", { roundId: round.id, contestantId: picked });
    setBusy(false);
    const err = (data as any)?.error;
    if (ok) { flash(`Vote recorded (+${(data as any)?.pointsAwarded ?? 0} points). Verify it once the round closes.`, "ok"); loadTotals(); loadMyVotes(); }
    else flash(messageFor(err, "Could not record your vote."), "err");
  }

  const maxVotes = Math.max(1, ...(board?.contestants ?? []).map((r) => r.votes));
  const pickedSlide = slides.find((s) => s.id === picked);
  const canCast = Boolean(fan && round && round.status === "open" && picked && !votedFor);

  return (
    <div>
      <div className="mb-6">
        <div className="eyebrow mb-2">Cast your vote</div>
        <h1 className="tracking-tight text-4xl font-semibold text-[#23252f]">Who wears the <span className="font-display italic text-[#c8a233]">crown</span>?</h1>
        <p className="mt-2 max-w-xl text-sm text-[#5f6172]">
          Pick a stage, crown your queen — one vote per wallet, per round. Closed rounds are anchored on Stellar, so
          every tally can be verified.
        </p>
        <p className="mt-2 text-sm text-[#5f6172]">
          {round
            ? <>{round.title} · {round.status}{board ? <> · <span className="tabular-nums">{board.total.toLocaleString()}</span> votes so far</> : null}</>
            : "Not open for voting yet"}
          <span className="tag-off ml-2">off-chain intake</span>
        </p>
      </div>

      {/* Pageant stages — red dot = open now, gold check = you've voted there. */}
      <div className="mb-8 flex flex-wrap gap-2">
        {PAGEANT_SEGMENTS.map((s) => {
          const hasOpen = rounds.some((r) => r.category === s.key && r.status === "open");
          const active = activeCat === s.key;
          const voted = votedCats.has(s.key);
          return (
            <button key={s.key} onClick={() => { setActiveCat(s.key); setPicked(""); }}
              className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition ${active ? "border-transparent bg-gradient-to-b from-[#d4af37] to-[#b8912f] text-[#1a1f35]" : "border-[#e7e2d3] bg-white text-[#5f6172] hover:border-[#c9a227]"}`}>
              {hasOpen && !voted && <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#c0392b]" />}
              {s.label}
              {voted && <Icons.Check size={13} strokeWidth={3} className={active ? "text-[#1a1f35]" : "text-[#0f6e56]"} aria-label="You voted in this stage" />}
            </button>
          );
        })}
      </div>

      {ready && !fan && (
        <div className="glass mb-6 p-4 text-sm text-[#3a3f52]">Connect your wallet (top right) to vote — Freighter, or Google/email.</div>
      )}

      {/* Loading — reserve the carousel's space so nothing jumps in. */}
      {cons.length === 0 && (
        <div className="flex items-center justify-center gap-5">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`glass p-2 ${i === 1 ? "w-72 sm:w-96" : "hidden w-44 sm:block sm:w-60"}`}>
              <div className="aspect-[3/4] w-full animate-pulse rounded-xl bg-[#efe9d8]" />
              <div className="mx-auto mt-3 h-4 w-28 animate-pulse rounded bg-[#efe9d8]" />
              <div className="mx-auto mb-1 mt-2 h-3 w-16 animate-pulse rounded bg-[#efe9d8]" />
            </div>
          ))}
        </div>
      )}

      {cons.length > 0 && (!round ? (
        <div className="glass p-8 text-center">
          <div className="font-display text-xl text-[#23252f]">{CATEGORY_LABEL[activeCat]} isn’t open yet</div>
          <p className="mt-2 text-sm text-[#7a7768]">Voting for this stage opens when the organizer starts its round. Try another stage above.</p>
        </div>
      ) : (
        <>
          <SpotlightCarousel
            slides={slides}
            onSelect={votedFor ? undefined : setPicked}
            selectedId={picked}
            votedId={votedFor}
            cta="Pick"
            ariaLabel={`${CATEGORY_LABEL[activeCat]} candidates`}
          />
          <div className="mt-8 flex flex-col items-center gap-3">
            {votedFor ? (
              <>
                <div className="rounded-xl border border-[#e6f6ef] bg-[#e6f6ef] px-4 py-2.5 text-sm font-semibold text-[#0f6e56]">
                  You’ve voted in {CATEGORY_LABEL[activeCat]} — one vote per wallet.
                </div>
                <Link href="/verify" className="text-sm text-[#7a7768] underline-offset-4 hover:underline">Verify your receipt</Link>
              </>
            ) : (
              <>
                {!picked && <div className="text-sm text-[#7a7768]">Select a contestant above — your vote confirms in the bar below.</div>}
                <Link href="/verify" className="text-sm text-[#7a7768] underline-offset-4 hover:underline">Already voted? Verify your receipt</Link>
              </>
            )}
          </div>
        </>
      ))}

      {/* Live totals for this stage */}
      {board && board.contestants.length > 0 && board.total > 0 && (
        <section className="mt-12">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="tracking-tight text-2xl font-semibold text-[#23252f]">Live tally</h2>
            <div className="flex items-center gap-4">
              <span className="text-sm tabular-nums text-[#7a7768]">{board.total.toLocaleString()} votes</span>
              <Link href="/leaderboard" className="text-sm text-[#a97f16] hover:underline">Full leaderboard →</Link>
            </div>
          </div>
          <div className="space-y-2">
            {board.contestants.slice(0, 6).map((r) => (
              <div key={r.id} className="glass flex items-center gap-3 p-3">
                <div className="flex w-28 shrink-0 items-center gap-1.5 truncate text-sm text-[#23252f]"><Flag sash={r.sash} /> {r.name}</div>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#efe9d8]">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#d4af37] to-[#b8912f] transition-all duration-500" style={{ width: `${Math.round((r.votes / maxVotes) * 100)}%` }} />
                </div>
                <div className="w-12 shrink-0 text-right font-display text-sm font-semibold tabular-nums text-[#b8912f]">{r.votes.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Sticky confirm bar — the single primary action, always reachable once a pick is made. */}
      {canCast && pickedSlide && (
        <div className="fixed inset-x-0 bottom-20 z-40 px-4 sm:bottom-6">
          <div className="glass mx-auto flex max-w-xl items-center justify-between gap-3 p-3 shadow-[0_24px_50px_-20px_rgba(120,100,40,0.5)]">
            <div className="min-w-0 text-sm text-[#5f6172]">
              Voting for <b className="text-[#23252f]">{pickedSlide.name}</b>
              <span className="hidden sm:inline"> in {CATEGORY_LABEL[activeCat]}</span>
            </div>
            <button className="btn-gold shrink-0" disabled={busy} onClick={cast}>
              {busy ? "Submitting…" : "Cast vote"}
            </button>
          </div>
        </div>
      )}

      <Toast msg={toast.msg} tone={toast.tone} />
    </div>
  );
}
