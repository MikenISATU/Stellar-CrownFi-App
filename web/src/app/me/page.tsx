"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "@/session/SessionProvider";
import { short } from "@/lib/format";
import { getJson } from "@/lib/api";
import { messageFor } from "@/lib/messages";
import { Toast } from "@/components/ui";
import { Icons } from "@/components/icons";

export default function MePage() {
  const { fan, ready, refresh } = useSession();
  const [data, setData] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState({ msg: "", tone: "ok" as "ok" | "err" });
  const flash = (msg: string, tone: "ok" | "err" = "ok") => { setToast({ msg, tone }); setTimeout(() => setToast({ msg: "", tone: "ok" }), 3000); };

  useEffect(() => { if (fan) getJson(`/api/dashboard`, null).then(setData); }, [fan]);
  useEffect(() => { if (fan) setName(fan.handle); }, [fan]);

  async function saveName() {
    setBusy(true);
    const r = await fetch("/api/fans/rename", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ handle: name }) });
    setBusy(false);
    if (r.ok) { await refresh(); setEditing(false); flash("Name updated"); }
    else { const d = await r.json().catch(() => ({})); flash(d.error === "handle_taken" ? "That name is taken." : d.error === "invalid_handle" ? "3–24 letters, numbers, spaces or _." : messageFor(d.error, "Could not rename."), "err"); }
  }

  if (ready && !fan) return <div className="glass p-8 text-center text-[#5f6172]">Connect your wallet to see your dashboard.</div>;

  return (
    <div>
      <div className="mb-8">
        <div className="eyebrow mb-2">Your account</div>
        {editing ? (
          <div className="flex flex-wrap items-center gap-2">
            <input className="field max-w-xs" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveName()} autoFocus />
            <button className="btn-gold !px-4 !py-2" disabled={busy} onClick={saveName}>{busy ? "…" : "Save"}</button>
            <button className="btn-ghost !px-4 !py-2" onClick={() => { setEditing(false); setName(fan?.handle ?? ""); }}>Cancel</button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <h1 className="tracking-tight text-4xl font-semibold text-[#23252f]">{fan?.handle}</h1>
            <button onClick={() => setEditing(true)} className="rounded-full border border-[#e7e2d3] p-1.5 text-[#7a7768] transition hover:border-[#c9a227] hover:text-[#a97f16]" aria-label="Rename"><Icons.Verify size={15} strokeWidth={2} /></button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="card-gold p-5">
          <div className="text-xs uppercase tracking-wider text-[#7a7768]">Loyalty points</div>
          <div className="mt-1 font-display text-4xl font-semibold text-[#b8912f]">{fan?.points ?? 0}</div>
          <div className="mt-1 text-xs text-[#8a8779]">Every vote, mint & prediction earns points</div>
        </div>
        <div className="card-gold p-5">
          <div className="text-xs uppercase tracking-wider text-[#7a7768]">Active predictions</div>
          <div className="mt-1 font-display text-4xl font-semibold text-[#b8912f]">{data?.activePredictions ?? 0}</div>
          <div className="mt-1 text-xs text-[#8a8779]">{(data?.totalStaked ?? 0).toLocaleString()} USDC staked</div>
        </div>
        <div className="card-gold p-5 sm:col-span-2">
          <div className="text-xs uppercase tracking-wider text-[#7a7768]">Stellar wallet</div>
          <div className="mono mt-2 break-all text-sm text-[#2a2d3a]">{fan?.walletAddress ?? "Created on your first purchase"}</div>
          <div className="mt-2 text-xs text-[#8a8779]">Managed for you. No seed phrase, no XLM needed.</div>
        </div>
      </div>

      {/* Collections */}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Panel title="Predictions" empty="No predictions yet." href="/predictions" cta="Predict now"
          rows={(data?.predictions ?? []).map((p: any) => ({ main: p.option, sub: p.question, tag: p.status, href: `/predictions/${p.marketId}` }))} />
        <Panel title="Votes" empty="You have not voted yet." href="/vote" cta="Vote now" rows={(data?.votes ?? []).map((v: any) => ({ main: v.contestant, sub: v.round, tag: v.status }))} />
        <Panel title="Tickets" empty="No tickets yet." href="/tickets" cta="Buy a ticket" rows={(data?.tickets ?? []).map((t: any) => ({ main: `${t.tier} · seat ${t.seat}`, sub: t.eventName, tag: t.tokenId ? `NFT ${short(t.tokenId, 5)}` : "" }))} />
      </div>

      {/* Collectibles — NFT gallery (art + token id, since wallets can't render Soroban NFTs yet) */}
      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="tracking-tight text-xl text-[#23252f]">Your collectibles</h2>
          <span className="chip">{(data?.collectibles ?? []).length}</span>
        </div>
        {(data?.collectibles ?? []).length === 0 ? (
          <div className="glass py-8 text-center">
            <p className="text-sm text-[#7a7768]">No collectibles yet.</p>
            <Link href="/contestants" className="btn-ghost mt-3">Collect a queen</Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(data?.collectibles ?? []).map((c: any, i: number) => (
              <div key={i} className="glass overflow-hidden">
                <div className="relative aspect-square w-full bg-gradient-to-br from-[#eacb63] to-[#b8912f]">
                  {c.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.imageUrl} alt={c.title} className="absolute inset-0 h-full w-full object-cover" />
                  )}
                  {c.tokenId && <span className="absolute right-2 top-2 rounded-full bg-[#1a1f35]/90 px-2 py-0.5 text-[11px] font-semibold text-[#f4e29a]">Token #{c.tokenId}</span>}
                </div>
                <div className="p-3">
                  <div className="font-display text-base text-[#23252f]">{c.title}</div>
                  <div className="mt-0.5 text-xs text-[#7a7768]">{c.priceUsdc} USDC · 1 per wallet{c.candidateId != null ? ` · candidate ${c.candidateId}` : ""}</div>
                  {c.mintTx && (
                    <a href={`https://stellar.expert/explorer/testnet/tx/${c.mintTx}`} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs font-semibold text-[#a97f16] hover:underline">View mint on explorer →</a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Toast msg={toast.msg} tone={toast.tone} />
    </div>
  );
}

function Panel({ title, rows, empty, href, cta }: { title: string; rows: { main: string; sub: string; tag: string; href?: string }[]; empty: string; href: string; cta: string }) {
  return (
    <div className="glass p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="tracking-tight text-xl text-[#23252f]">{title}</h2>
        <span className="chip">{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <div className="py-6 text-center">
          <p className="text-sm text-[#7a7768]">{empty}</p>
          <Link href={href} className="btn-ghost mt-3">{cta}</Link>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r, i) => {
            const inner = (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm text-[#23252f]">{r.main}</span>
                  {r.tag && <span className={`shrink-0 text-[11px] ${r.tag === "won" ? "text-emerald-700" : r.tag === "lost" ? "text-[#9f1239]" : "mono text-emerald"}`}>{r.tag}</span>}
                </div>
                <div className="truncate text-xs text-[#8a8779]">{r.sub}</div>
              </>
            );
            return r.href
              ? <Link key={i} href={r.href} className="block rounded-xl bg-[#faf7ef] px-3 py-2 hover:bg-[#f5efe0]">{inner}</Link>
              : <div key={i} className="rounded-xl bg-[#faf7ef] px-3 py-2">{inner}</div>;
          })}
        </div>
      )}
    </div>
  );
}
