"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "@/session/SessionProvider";
import { Toast } from "@/components/ui";
import { getJson, postJson } from "@/lib/api";
import { messageFor } from "@/lib/messages";
import { signTx } from "@/wallet/sign";
import { TIER_LIST } from "@/lib/tiers";
import { TicketHero } from "@/components/tickets/TicketHero";
import { TicketTierSelector } from "@/components/tickets/TicketTierSelector";
import { TicketCheckoutPanel } from "@/components/tickets/TicketCheckoutPanel";
import { TicketSuccessBanner } from "@/components/tickets/TicketSuccessBanner";
import { TicketList } from "@/components/tickets/TicketList";
import { TicketDemoLinks } from "@/components/tickets/TicketDemoLinks";
import { SeatAssignmentModal } from "@/components/tickets/SeatAssignmentModal";
import { convertToSeatId } from "@/lib/tickets/seat";
import type { Ticket } from "@/components/tickets/types";
import type { SeatSelection } from "@/components/SeatMap";

const TIERS = TIER_LIST.map((t) => ({ name: t.name, price: t.priceUsdc, perks: t.perks }));

function TicketsPageInner() {
  const { fan, address } = useSession();
  const searchParams = useSearchParams();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const paramTier = searchParams.get("tier");
  const [tier, setTier] = useState(paramTier && TIER_LIST.some((t) => t.name === paramTier) ? paramTier : "Gold");
  const [busy, setBusy] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [toast, setToast] = useState({ msg: "", tone: "ok" as "ok" | "err" });
  const [lastTicketId, setLastTicketId] = useState<string | null>(null);

  const [assigningTicket, setAssigningTicket] = useState<Ticket | null>(null);
  const [chosenSeat, setChosenSeat] = useState<SeatSelection | null>(null);
  const [savingSeat, setSavingSeat] = useState(false);

  function handleTierChange(newTier: string) {
    setTier(newTier);
    setChosenSeat(null);
  }

  function load() {
    getJson<Ticket[]>("/api/tickets", []).then(setTickets);
  }

  useEffect(load, []);

  const refreshBalance = useCallback(() => {
    if (address) {
      getJson<{ balanceUsdc: number }>(`/api/usdc-balance?address=${address}`, { balanceUsdc: 0 }).then((b) => setBalance(b.balanceUsdc));
    } else {
      setBalance(null);
    }
  }, [address]);

  useEffect(refreshBalance, [refreshBalance]);

  function flash(msg: string, tone: "ok" | "err") {
    setToast({ msg, tone });
    setTimeout(() => setToast({ msg: "", tone: "ok" }), 3200);
  }

  function closeSeatModal() {
    setAssigningTicket(null);
    setChosenSeat(null);
  }

  async function confirmSeat() {
    if (!assigningTicket || !chosenSeat) return;
    setSavingSeat(true);
    try {
      const r = await postJson<any>(`/api/tickets/${assigningTicket.id}/assign-seat`, { seat: chosenSeat.label, fanId: fan?.id });
      if (!r.ok) throw new Error((r.data as any)?.error ?? "assign_failed");
      flash(`Seat ${chosenSeat.label} assigned successfully!`, "ok");
      closeSeatModal();
      load();
    } catch (e: any) {
      flash(messageFor(String(e?.message ?? ""), "Could not assign your seat. Please try again."), "err");
    } finally {
      setSavingSeat(false);
    }
  }

  async function getTestUsdc() {
    if (!address) {
      flash("Connect your Freighter wallet first.", "err");
      return;
    }
    setBusy(true);
    const r = await postJson<any>("/api/faucet", { walletAddress: address, amountUsdc: 200 });
    setBusy(false);
    if (r.ok) {
      flash("+200 test USDC sent to your wallet.", "ok");
      refreshBalance();
    } else {
      flash(`Faucet failed: ${(r.data as any)?.error ?? "error"}`, "err");
    }
  }

  async function buy() {
    if (!fan || !address) {
      flash("Connect your Freighter wallet first.", "err");
      return;
    }
    setBusy(true);
    try {
      const prep = await postJson<any>("/api/tickets/prepare-buy", { tier, buyerAddress: address, fanId: fan.id });
      if (!prep.ok) throw new Error((prep.data as any)?.error ?? "prepare_failed");

      if ((prep.data as any).mock) {
        const r = await postJson<any>("/api/tickets", {
          fanId: fan.id,
          eventName: "Coronation Night 2026",
          tier,
          priceUsdc: TIERS.find((x) => x.name === tier)!.price,
        });
        if (!r.ok) throw new Error((r.data as any)?.error ?? "buy_failed");
        const newTicket = (r.data as any)?.ticket;
        if (newTicket?.id) {
          setLastTicketId(newTicket.id);
          setAssigningTicket(newTicket);
        }
        flash("Ticket minted! Please choose your seat.", "ok");
        return;
      }

      const signed = await signTx((prep.data as any).xdr, fan);
      if (signed.error || !signed.signedXdr) throw new Error(signed.error ?? "You cancelled the signature.");

      const conf = await postJson<any>("/api/tickets/confirm-buy", {
        tier,
        fanId: fan.id,
        signedXdr: signed.signedXdr,
        intentId: (prep.data as any).intentId,
      });
      if (!conf.ok) throw new Error((conf.data as any)?.error ?? "confirm_failed");

      const newTicket = (conf.data as any)?.ticket;
      if (newTicket?.id) {
        setLastTicketId(newTicket.id);
        setAssigningTicket(newTicket);
      }
      flash(`Paid ${(prep.data as any).priceUsdc} USDC on-chain — ticket minted! Please choose your seat.`, "ok");
    } catch (e: any) {
      flash(messageFor(String(e?.message ?? ""), "Could not complete the purchase."), "err");
    } finally {
      setBusy(false);
      load();
      refreshBalance();
    }
  }

  const mine = tickets.filter((t) => t.fan.handle === fan?.handle);

  // Seats already assigned on other tickets for this event — shown as unavailable
  // in the seat map so two buyers can't pick the same seat.
  const takenSeatIds = tickets
    .filter((t) => t.id !== assigningTicket?.id && t.seat && t.seat !== "Unassigned")
    .map((t) => convertToSeatId(t.seat, t.tier))
    .filter((v): v is string => Boolean(v));

  return (
    <div className="relative min-h-[70vh] overflow-hidden rounded-[2rem] border border-[#e7d9a8] bg-[#faf7ef] shadow-[0_30px_70px_-42px_rgba(184,145,47,0.75)]">
      <div inert aria-hidden="true" className="pointer-events-none select-none p-5 opacity-40 blur-[6px] sm:p-8">
        <TicketHero hasAddress={Boolean(address)} balance={balance} busy={busy} onGetTestUsdc={getTestUsdc} />
        <TicketTierSelector tiers={TIERS} selectedTier={tier} onSelectTier={handleTierChange} />
        <TicketCheckoutPanel busy={busy} fanConnected={Boolean(fan)} tier={tier} onBuy={buy} />
        <TicketSuccessBanner ticketId={lastTicketId} onDismiss={() => setLastTicketId(null)} />
        <TicketList tickets={mine} onChooseSeat={(ticket) => { setAssigningTicket(ticket); setChosenSeat(null); }} />
        <TicketDemoLinks />
      </div>

      <div className="absolute inset-0 z-20 flex items-start justify-center bg-white/35 px-4 pt-12 backdrop-blur-[2px] sm:pt-20">
        <div className="relative w-full max-w-lg overflow-hidden rounded-[2rem] border border-[#e7d9a8] bg-white/95 px-6 py-10 text-center shadow-[0_30px_80px_-35px_rgba(184,145,47,0.85)] sm:px-10 sm:py-12">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(212,175,55,0.22),transparent_55%)]" />
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/logo.png"
              alt="CrownFi"
              className="mx-auto h-20 w-20 object-contain drop-shadow-[0_10px_24px_rgba(184,145,47,0.38)]"
            />
            <div className="eyebrow mt-6">Ticketing</div>
            <h1 className="mt-3 tracking-tight text-4xl font-semibold text-[#23252f] sm:text-5xl">
              Seat reservations <span className="font-display italic text-[#c8a233]">coming soon</span>
            </h1>
            <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-[#5f6172] sm:text-base">
              We’re preparing the CrownFi ticketing experience. Verified seats and on-chain tickets will open soon.
            </p>
            <span className="mt-7 inline-flex items-center rounded-full border border-[#e7d9a8] bg-[#fbf4dd] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#9a7417]">
              Launching soon
            </span>
          </div>
        </div>
      </div>

      <SeatAssignmentModal
        ticket={assigningTicket}
        selectedSeat={chosenSeat}
        saving={savingSeat}
        takenSeatIds={takenSeatIds}
        onSelectSeat={setChosenSeat}
        onCancel={closeSeatModal}
        onConfirm={confirmSeat}
      />
      <Toast msg={toast.msg} tone={toast.tone} />
    </div>
  );
}

export default function TicketsPage() {
  return (
    <Suspense fallback={<div className="text-center py-12 text-[#7a7768]">Loading tickets…</div>}>
      <TicketsPageInner />
    </Suspense>
  );
}
