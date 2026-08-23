"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "@/session/SessionProvider";
import { LoopCarousel } from "@/components/LoopCarousel";
import { Flag } from "@/components/Flag";
import { Toast } from "@/components/ui";
import { short } from "@/lib/format";
import { getJson, postJson } from "@/lib/api";
import { messageFor } from "@/lib/messages";
import { signTx } from "@/wallet/sign";

type Collectible = { id: string; title: string; priceUsdc: number; metadataUri: string; imageUrl?: string | null; tokenId?: string; contestant: { id: string; name: string; country: string; sash: string; portraitUrl?: string | null } };

export default function CollectPage() {
  const { fan, address } = useSession();
  const [items, setItems] = useState<Collectible[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const [toast, setToast] = useState({ msg: "", tone: "ok" as "ok" | "err" });

  function load() { getJson<Collectible[]>("/api/collectibles", []).then((d) => { setItems(d); setLoading(false); }); }
  useEffect(load, []);

  const refreshBalance = useCallback(() => {
    if (address) getJson<{ balanceUsdc: number }>(`/api/usdc-balance?address=${address}`, { balanceUsdc: 0 }).then((b) => setBalance(b.balanceUsdc));
    else setBalance(null);
  }, [address]);
  useEffect(refreshBalance, [refreshBalance]);

  function flash(msg: string, tone: "ok" | "err") {
    setToast({ msg, tone });
    setTimeout(() => setToast({ msg: "", tone: "ok" }), 3200);
  }

  async function getTestUsdc() {
    if (!address) { flash("Connect your Freighter wallet first.", "err"); return; }
    setBusy("faucet");
    const r = await postJson<any>("/api/faucet", { walletAddress: address, amountUsdc: 50 });
    setBusy("");
    if (r.ok) { flash("+50 test USDC sent to your wallet.", "ok"); refreshBalance(); }
    else flash(`Faucet failed: ${(r.data as any)?.error ?? "error"}`, "err");
  }

  async function buy(c: Collectible) {
    if (!fan || !address) { flash("Connect your Freighter wallet first.", "err"); return; }
    setBusy(c.id);
    try {
      // Step 1 — ask the backend to build the purchase transaction.
      const prep = await postJson<any>("/api/collectibles/prepare-buy", { collectibleId: c.id, buyerAddress: address, fanId: fan.id });
      if (!prep.ok) throw new Error((prep.data as any)?.error ?? "prepare_failed");

      if ((prep.data as any).mock) {
        // Mock mode: no chain — just mint.
        const r = await postJson<any>("/api/collectibles", { fanId: fan.id, collectibleId: c.id });
        if (!r.ok) throw new Error((r.data as any)?.error ?? "buy_failed");
        flash("Collected (mock). +10 points.", "ok");
        return;
      }

      // Step 2 — buyer approves the USDC payment in Freighter.
      const { xdr, priceUsdc } = prep.data as any;
      const signed = await signTx(xdr, fan);
      if (signed.error || !signed.signedXdr) throw new Error(signed.error ?? "You cancelled the signature.");

      // Step 3 — submit + mint the NFT.
      const conf = await postJson<any>("/api/collectibles/confirm-buy", { collectibleId: c.id, fanId: fan.id, signedXdr: signed.signedXdr, intentId: (prep.data as any).intentId });
      if (!conf.ok) throw new Error((conf.data as any)?.error ?? "confirm_failed");

      flash(`Collected! ${priceUsdc} USDC split on-chain to the contestant. +10 points.`, "ok");
    } catch (e: any) {
      flash(messageFor(String(e?.message ?? ""), "Could not complete the purchase."), "err");
    } finally {
      setBusy(""); load(); refreshBalance();
    }
  }

  return (
    <div className="space-y-10">
      {/* ── Header + wallet ─────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <div className="eyebrow mb-2">Collect</div>
          <h1 className="tracking-tight text-4xl font-semibold text-[#23252f]">Collectibles that fund <span className="font-display italic text-[#c8a233]">delegates</span></h1>
          <p className="mt-2 max-w-xl text-sm text-[#5f6172]">
            One official portrait per delegate, minted on Stellar. The payment splits on-chain — her cut lands
            instantly. One per wallet.
          </p>
        </div>

        {address ? (
          <div className="card-gold w-full px-5 py-4 sm:w-auto sm:min-w-[13rem]">
            <div className="text-[11px] uppercase tracking-wider text-[#7a7768]">Your test USDC</div>
            <div className="font-display text-3xl font-semibold tabular-nums text-[#b8912f]">
              {balance == null ? "—" : balance.toFixed(2)}
            </div>
            <button className="btn-ghost mt-2 w-full !px-3 !py-1.5 text-xs" disabled={busy === "faucet"} onClick={getTestUsdc}>
              {busy === "faucet" ? "Sending…" : "Get 50 test USDC"}
            </button>
          </div>
        ) : (
          <div className="card-gold w-full px-5 py-4 text-sm text-[#5f6172] sm:w-auto sm:max-w-[15rem]">
            Connect your Freighter wallet to see your balance and start collecting.
          </div>
        )}
      </div>

      {/* ── How it works ────────────────────────────────── */}
      <section className="grid gap-3 sm:grid-cols-3">
        {[
          { n: "1", t: "Top up test USDC", d: "One tap funds your wallet. Testnet money — nothing real is spent." },
          { n: "2", t: "Pick your delegate", d: "Every portrait is 50 USDC, one per wallet." },
          { n: "3", t: "Confirm in Freighter", d: "Approve once — the NFT lands in your wallet, her cut pays out on-chain." },
        ].map((s) => (
          <div key={s.n} className="card-gold p-5">
            <div className="flex items-center gap-2">
              <span className="num-gold">{s.n}</span>
              <span className="font-display text-base text-[#23252f]">{s.t}</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-[#5f6172]">{s.d}</p>
          </div>
        ))}
      </section>

      {/* ── The collectibles themselves ─────────────────── */}
      <section>
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="tracking-tight text-2xl font-semibold text-[#23252f]">Available to collect</h2>
          {!loading && items.length > 0 && (
            <span className="text-sm text-[#7a7768]">{items.length} collectible{items.length === 1 ? "" : "s"} · 1 per wallet</span>
          )}
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className={`glass p-3 ${i === 1 ? "w-72 sm:w-80" : "hidden w-56 opacity-60 sm:block"}`}>
                <div className="aspect-square w-full animate-pulse rounded-xl bg-[#efe9d8]" />
                <div className="mx-auto mt-3 h-4 w-32 animate-pulse rounded bg-[#efe9d8]" />
                <div className="mx-auto mt-2 h-3 w-20 animate-pulse rounded bg-[#efe9d8]" />
              </div>
            ))}
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="glass p-10 text-center">
            <div className="font-display text-xl text-[#23252f]">Nothing to collect yet</div>
            <p className="mt-2 text-sm text-[#7a7768]">Collectibles go live once a pageant is approved. Check back shortly.</p>
          </div>
        )}

        {!loading && items.length > 0 && (
          <LoopCarousel
            items={items}
            ariaLabel="Candidate collectibles"
            render={(c, { center }) => {
              const collected = Boolean(c.tokenId);
              const affordable = balance == null || balance >= c.priceUsdc;
              return (
                <div className={`glass overflow-hidden p-3 ${center ? "shadow-spot ring-1 ring-[#e3cf8f]" : ""}`}>
                  {/* The NFT artwork itself — the resolved image from the token's metadata. */}
                  <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-[#faf7ef]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={c.imageUrl ?? c.contestant.portraitUrl ?? ""}
                      alt={c.title}
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                    {collected && <span className="tag-on absolute left-2 top-2">Minted</span>}
                  </div>

                  <div className="px-1 pb-1 pt-3 text-center">
                    <div className="truncate font-display text-lg font-semibold text-[#23252f]">{c.contestant.name}</div>
                    <div className="flex items-center justify-center gap-1.5 text-xs text-[#6f6c5f]">
                      <Flag sash={c.contestant.sash} /> {c.contestant.country}
                    </div>

                    <div className="mt-2 font-display text-xl font-semibold tabular-nums text-[#b8912f]">{c.priceUsdc} USDC</div>
                    {address && !affordable && <div className="text-[11px] text-[#9a5a12]">Top up to collect</div>}

                    {/* Profile button sits under every collectible. */}
                    <div className="mt-3 flex flex-col gap-2">
                      <button className="btn-gold w-full" disabled={busy === c.id} onClick={() => buy(c)}>
                        {busy === c.id ? "Confirm in wallet…" : "Collect"}
                      </button>
                      <Link href={`/contestants/${c.contestant.id}`} className="btn-ghost w-full">View profile</Link>
                    </div>

                    {c.tokenId && <div className="mono mt-2 text-[11px] text-emerald">NFT {short(c.tokenId, 6)}</div>}
                  </div>
                </div>
              );
            }}
          />
        )}
      </section>

      <Toast msg={toast.msg} tone={toast.tone} />
    </div>
  );
}
