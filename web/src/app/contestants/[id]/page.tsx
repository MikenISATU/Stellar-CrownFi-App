"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useSession } from "@/session/SessionProvider";
import { NftCard } from "@/components/NftCard";
import { Toast } from "@/components/ui";
import { short } from "@/lib/format";
import { getJson, postJson } from "@/lib/api";
import { messageFor } from "@/lib/messages";
import { signTx } from "@/wallet/sign";

type Collectible = {
  id: string; title: string; priceUsdc: number; metadataUri: string;
  candidateId: number | null; edition: number; listingId: number | null;
  minted: number; perWallet: number; ownedByMe: boolean;
};
type Candidate = {
  contestant: { id: string; name: string; country: string; sash: string; portraitUrl: string | null; continent?: string; height?: string; nftUrl?: string | null } | null;
  stats: { votes: number; rank: number; totalContestants: number; totalVotes: number; roundId: string | null; roundTitle: string | null; status: string | null };
  collectibles: Collectible[];
  error?: string;
};

type MintPhase = "idle" | "preparing" | "signing" | "confirming" | "success" | "error";

export default function CandidatePage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const { fan, address, connect, connecting } = useSession();

  const [data, setData] = useState<Candidate | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [balance, setBalance] = useState<number | null>(null);
  const [phase, setPhase] = useState<MintPhase>("idle");
  const [mintResult, setMintResult] = useState<{ tokenId?: string; mintTx?: string; error?: string }>({});
  const [toast, setToast] = useState({ msg: "", tone: "ok" as "ok" | "err" });
  const [pm, setPm] = useState<{ gcash: boolean; enabled: boolean; environment: string; label: string } | null>(null);
  const [gcashOpen, setGcashOpen] = useState(false);
  const [gcashBusy, setGcashBusy] = useState(false);

  useEffect(() => { getJson<any>("/api/payment-method", null).then(setPm); }, []);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const r = await fetch(`/api/contestants/${id}`, { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      const d: Candidate = await r.json();
      setData(d);
      setState(d.contestant ? "ready" : "error");
    } catch {
      setState("error");
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const refreshBalance = useCallback(() => {
    if (address) getJson<{ balanceUsdc: number }>(`/api/usdc-balance?address=${address}`, { balanceUsdc: 0 }).then((b) => setBalance(b.balanceUsdc));
    else setBalance(null);
  }, [address]);
  useEffect(refreshBalance, [refreshBalance]);

  function flash(msg: string, tone: "ok" | "err") {
    setToast({ msg, tone });
    setTimeout(() => setToast({ msg: "", tone: "ok" }), 3400);
  }

  async function mint(c: Collectible) {
    if (!fan || !address) { flash("Connect your Freighter wallet first.", "err"); return; }
    setMintResult({});
    setPhase("preparing");
    try {
      const prep = await postJson<any>("/api/collectibles/prepare-buy", { collectibleId: c.id, buyerAddress: address, fanId: fan.id });
      if (!prep.ok) throw new Error((prep.data as any)?.error ?? "prepare_failed");

      if ((prep.data as any).mock) {
        setPhase("confirming");
        const r = await postJson<any>("/api/collectibles", { fanId: fan.id, collectibleId: c.id });
        if (!r.ok) throw new Error((r.data as any)?.error ?? "buy_failed");
        setMintResult({ tokenId: (r.data as any)?.purchase?.tokenId });
        setPhase("success");
        flash("Minted! +10 loyalty points.", "ok");
        load(); refreshBalance();
        return;
      }

      setPhase("signing");
      const { xdr } = prep.data as any;
      const signed = await signTx(xdr, fan);
      if (signed.error || !signed.signedXdr) throw new Error(signed.error ?? "You cancelled the signature.");

      setPhase("confirming");
      const conf = await postJson<any>("/api/collectibles/confirm-buy", { collectibleId: c.id, fanId: fan.id, signedXdr: signed.signedXdr, intentId: (prep.data as any).intentId });
      if (!conf.ok) throw new Error((conf.data as any)?.error ?? "confirm_failed");
      setMintResult({ tokenId: (conf.data as any)?.purchase?.tokenId, mintTx: (conf.data as any)?.mintTx });
      setPhase("success");
      flash("Minted on-chain! +10 loyalty points.", "ok");
      load(); refreshBalance();
    } catch (e: any) {
      const friendly = messageFor(String(e?.message ?? ""), "The mint didn’t go through. Please try again.");
      setMintResult({ error: friendly });
      setPhase("error");
      flash(friendly, "err");
    }
  }

  // Start a real GCash (PayMongo) checkout and redirect to the hosted page.
  async function payGcash(c: Collectible) {
    setGcashBusy(true);
    try {
      const r = await postJson<any>("/api/payments/gcash/checkout", { collectibleId: c.id });
      if (r.ok && (r.data as any)?.url) { window.location.href = (r.data as any).url; return; }
      const err = (r.data as any)?.error;
      flash(err === "gcash_not_configured" ? "GCash isn’t connected yet — add PayMongo keys to enable it." : messageFor(err, "Couldn’t start GCash checkout."), "err");
    } catch {
      flash("Couldn’t start GCash checkout.", "err");
    } finally {
      setGcashBusy(false);
    }
  }

  async function getTestUsdc() {
    if (!address) { flash("Connect your wallet first.", "err"); return; }
    const r = await postJson<any>("/api/faucet", { amountUsdc: 50 });
    if (r.ok) { flash("+50 test USDC sent.", "ok"); refreshBalance(); }
    else flash(`Faucet failed: ${(r.data as any)?.error ?? "error"}`, "err");
  }

  if (state === "loading") {
    return <div className="grid gap-8 lg:grid-cols-2">
      <div className="space-y-4"><div className="h-10 w-2/3 animate-pulse rounded bg-[#efe9d8]" /><div className="h-40 w-full animate-pulse rounded-2xl bg-[#efe9d8]" /></div>
      <div className="aspect-[5/4] w-full animate-pulse rounded-2xl bg-[#efe9d8]" />
    </div>;
  }
  if (state === "error" || !data?.contestant) {
    return <div className="glass p-10 text-center">
      <div className="font-display text-2xl text-[#23252f]">Candidate not found</div>
      <Link href="/contestants" className="btn-gold mt-4 inline-block">Back to collectibles</Link>
    </div>;
  }

  const c = data.contestant;
  const s = data.stats;
  const col = data.collectibles[0];
  const firstName = c.name.split(" ")[0];
  const busy = phase === "preparing" || phase === "signing" || phase === "confirming";
  const owned = !!col?.ownedByMe || phase === "success";

  return (
    <div className="space-y-10">
      <Link href="/leaderboard" className="text-sm text-[#7a7768] hover:text-[#23252f]">← Back to leaderboard</Link>

      <div className="grid items-center gap-10 lg:grid-cols-2">
        {/* Left: support copy + mint */}
        <div>
          <div className="eyebrow mb-3">Exclusive drop</div>
          <h1 className="tracking-tight text-5xl font-semibold text-[#c8a233] sm:text-6xl">Support Your Queen</h1>
          <p className="mt-5 max-w-lg text-[#5f6172]">
            Every official candidate portrait is a digital collectible on Stellar. Mint your favorite queen to own it.
          </p>
          <p className="mt-3 max-w-lg text-sm text-[#7a7768]">
            Your payment goes directly to the delegate you back.
          </p>

          {col && (
            <>
              <div className="mt-6 flex flex-wrap gap-8 border-y border-[#eee6d3] py-4">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-[#7a7768]">Network</div>
                  <div className="mt-0.5 flex items-center gap-1.5 font-display text-lg text-[#23252f]"><span className="inline-block h-2 w-2 rounded-full bg-emerald" /> Stellar Testnet</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-[#7a7768]">Price</div>
                  <div className="mt-0.5 font-display text-lg text-[#23252f]">{col.priceUsdc.toFixed(2)} USDC</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-[#7a7768]">Supply</div>
                  <div className="mt-0.5 font-display text-lg text-[#23252f]">1 per wallet</div>
                  <div className="text-[10px] text-[#9a968b]">unlimited edition · {col.minted} minted</div>
                </div>
              </div>

              {/* Wallet status */}
              <div className="mt-4 rounded-xl surface-soft px-3 py-2 text-xs">
                {address
                  ? <span className="text-[#5f6172]">Wallet <span className="mono text-[#23252f]">{short(address, 5)}</span>{balance != null && <> · <span className="text-[#a97f16]">{balance.toFixed(2)} USDC</span></>}</span>
                  : <span className="text-[#7a7768]">No wallet connected.</span>}
              </div>

              {/* Progress / result */}
              {phase !== "idle" && (
                <div className={`mt-3 rounded-xl px-3 py-2 text-sm ${phase === "error" ? "bg-[#fbe9ef] text-[#9f1239]" : phase === "success" ? "bg-[#e1f5ee] text-[#0f6e56]" : "bg-[#faf0d2] text-[#8a6d1f]"}`}>
                  {phase === "preparing" && "Preparing transaction…"}
                  {phase === "signing" && "Awaiting signature in Freighter…"}
                  {phase === "confirming" && "Confirming mint…"}
                  {phase === "success" && <>Minted{mintResult.tokenId ? <> · <b>Token #{mintResult.tokenId}</b></> : ""}! View it on your <Link href="/me" className="underline">collection</Link>{mintResult.mintTx ? <> · <a href={`https://stellar.expert/explorer/testnet/tx/${mintResult.mintTx}`} target="_blank" rel="noopener noreferrer" className="underline">explorer</a></> : ""}.</>}
                  {phase === "error" && (mintResult.error ?? "Something went wrong.")}
                </div>
              )}

              <div className="mt-5 flex flex-wrap gap-3">
                {!address ? (
                  <button onClick={connect} disabled={connecting} className="btn-gold !px-10 !py-3 text-lg">{connecting ? "Connecting…" : "Connect wallet to mint"}</button>
                ) : owned ? (
                  <Link href="/me" className="btn-gold !px-10 !py-3 text-lg">View in your collection</Link>
                ) : pm?.gcash && pm.enabled ? (
                  <button onClick={() => setGcashOpen(true)} disabled={busy} className="btn-gold !px-10 !py-3 text-lg">
                    {busy ? "Minting…" : `Pay with GCash · ${col.priceUsdc} USDC`}
                  </button>
                ) : (
                  <button onClick={() => mint(col)} disabled={busy} className="btn-gold !px-10 !py-3 text-lg">
                    {busy ? "Minting…" : "Mint Here"}
                  </button>
                )}
                {address && !owned && <button onClick={getTestUsdc} className="btn-ghost !px-5 !py-3">Get test USDC</button>}
              </div>
              {col.ownedByMe && phase !== "success" && <div className="mt-2 text-xs text-[#0f6e56]">✓ You already collected this one (1 per wallet).</div>}
            </>
          )}
        </div>

        {/* Right: the floating collectible card */}
        <div className="space-y-5">
          {c.nftUrl ? (
            <div className="animate-float [transform-style:preserve-3d]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.nftUrl} alt={`${c.name} collectible`} className="w-full rounded-2xl shadow-[0_45px_90px_-30px_rgba(184,145,47,0.75)]" />
            </div>
          ) : (
            <div className="animate-float">
              <NftCard
                name={c.name}
                country={c.country}
                sash={c.sash}
                continent={c.continent ?? "Asia"}
                height={c.height ?? "—"}
                photo={c.portraitUrl}
                edition={col?.candidateId ?? 1}
                supply={1}
                tokenId={mintResult.tokenId}
              />
            </div>
          )}
          {/* Live stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="glass p-4 text-center">
              <div className="font-display text-3xl font-semibold text-[#b8912f]">#{s.rank || "—"}</div>
              <div className="mt-1 text-[11px] uppercase tracking-wider text-[#7a7768]">Rank</div>
            </div>
            <div className="glass p-4 text-center">
              <div className="font-display text-3xl font-semibold text-[#b8912f]">{s.votes.toLocaleString()}</div>
              <div className="mt-1 text-[11px] uppercase tracking-wider text-[#7a7768]">Votes</div>
            </div>
            <div className="glass p-4 text-center">
              <div className="font-display text-3xl font-semibold text-[#b8912f]">{s.totalVotes ? Math.round((s.votes / s.totalVotes) * 100) : 0}%</div>
              <div className="mt-1 text-[11px] uppercase tracking-wider text-[#7a7768]">Share</div>
            </div>
          </div>
          <Link href="/vote" className="btn-ghost w-full text-center">Vote for {firstName}</Link>
        </div>
      </div>

      {/* GCash checkout — shown when the admin has enabled GCash as the payment provider. */}
      {gcashOpen && col && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40" onClick={() => setGcashOpen(false)} />
          <div className="relative z-10 w-full max-w-sm glass p-6 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/gcash.svg" alt="GCash" className="mx-auto mb-3 h-10 w-auto" />
            <div className="font-display text-xl text-[#23252f]">Pay with GCash</div>
            <p className="mt-2 text-sm text-[#5f6172]">Collect <b>{col.title}</b> for <b>{col.priceUsdc} USDC</b>, paid via GCash.</p>
            <button className="btn-gold mt-4 w-full" disabled={gcashBusy} onClick={() => payGcash(col)}>{gcashBusy ? "Starting GCash…" : `Pay ${col.priceUsdc} USDC with GCash`}</button>
            {pm?.environment !== "production" && (
              <button className="btn-ghost mt-2 w-full" disabled={busy} onClick={() => { setGcashOpen(false); mint(col); }}>Or collect with test USDC (testnet)</button>
            )}
            <div className="mt-2 text-[11px] text-[#9a968b]">GCash checkout needs a connected PayMongo merchant account.</div>
            <button className="mt-2 text-xs text-[#7a7768] hover:underline" onClick={() => setGcashOpen(false)}>Cancel</button>
          </div>
        </div>
      )}

      <Toast msg={toast.msg} tone={toast.tone} />
    </div>
  );
}
