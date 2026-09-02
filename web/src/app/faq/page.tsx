"use client";
import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";

type QA = { q: string; a: string };
type Group = { title: string; items: QA[]; id?: string };

const GROUPS: Group[] = [
  {
    title: "Wallet & sign-in",
    items: [
      { q: "How do I sign in?", a: "There are no passwords. Click “Connect Freighter”, approve the popup, and sign the one-time message. Your Stellar wallet address is your identity, and CrownFi never sees your private key." },
      { q: "Which wallet and network do I need?", a: "The Freighter browser extension, set to Stellar Testnet. If you’re on the wrong network, connecting is blocked with a clear message." },
      { q: "I don’t have Freighter — what now?", a: "Install it from freighter.app, set it to Testnet, then reload and connect. CrownFi requires a real wallet to sign in." },
      { q: "What if I switch or lock my wallet?", a: "If you switch accounts in Freighter, you’ll be asked to sign in again as the new wallet. A locked wallet keeps your session until it expires." },
    ],
  },
  {
    title: "Voting & leaderboard",
    items: [
      { q: "How does voting work?", a: "Votes are taken off-chain for speed and privacy. You can vote once per round; duplicate votes are blocked at the database level. Vote totals update live on the vote page and the leaderboard." },
      { q: "Is my vote really counted?", a: "When a round closes, all votes are sealed into a Merkle root and anchored on Stellar. On the Verify page you can pull a cryptographic receipt proving your vote is in the official tally — without exposing your identity." },
      { q: "Does buying tickets or collectibles give me more votes?", a: "No. Support and purchases never increase voting power. Voting stays capped and fair." },
    ],
  },
  {
    title: "Tickets & seats",
    items: [
      { q: "How do I buy a ticket?", a: "Pick a tier on the Tickets page and buy. In live mode you approve a USDC payment in Freighter; in demo mode it’s simulated. After purchase, choose your seat from the interactive stadium map." },
      { q: "How does seat selection work?", a: "Each ticket unlocks its tier’s zone in the seat map. Taken seats are greyed out, and no two tickets can hold the same seat." },
      { q: "How do I get into the event?", a: "Your ticket has a printable voucher with a QR code. At the door it’s scanned once and marked redeemed — it can’t be reused." },
    ],
  },
  {
    title: "NFTs & minting",
    items: [
      { q: "What are candidate collectibles?", a: "Official contestant portrait NFTs. Open a candidate’s page to see price, supply, and how many are minted, then mint directly there." },
      { q: "Where does my payment go?", a: "In live mode the USDC is split on-chain — the contestant receives her cut instantly and a small platform fee is taken. In demo mode it’s simulated." },
      { q: "Can I mint the same collectible twice?", a: "No — one of each collectible per fan, so points and ownership stay fair." },
    ],
  },
  {
    title: "Loyalty points & rewards",
    items: [
      { q: "How do I earn points?", a: "You earn points by voting, collecting NFTs, and completing social tasks (follow, join Discord, share). Your balance and full history live on the Rewards page." },
      { q: "How do I redeem rewards?", a: "Spend points in the loyalty shop. Redeeming validates your balance and any limited stock, then issues you a voucher code." },
    ],
  },
  {
    title: "Transactions & security",
    items: [
      { q: "Is this real money?", a: "No. CrownFi runs on Stellar Testnet with test USDC. It’s a demo — don’t use it for real-money voting or ticketing." },
      { q: "How is my identity protected?", a: "Actions are tied to a wallet-signed session, so no one can vote or act on your behalf. Voter identity is never written on-chain." },
    ],
  },
];

function Item({ qa }: { qa: QA }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card-gold">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left">
        <span className="font-display text-base font-semibold text-[#23252f]">{qa.q}</span>
        <ChevronDown size={18} className={`shrink-0 text-[#a97f16] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="border-t border-[#eee6d3] px-5 py-4 text-sm leading-relaxed text-[#5f6172]">{qa.a}</div>}
    </div>
  );
}

export default function FaqPage() {
  return (
    <div className="space-y-10">
      <header>
        <div className="eyebrow mb-2">Help center</div>
        <h1 className="tracking-tight text-4xl font-semibold text-[#23252f] sm:text-5xl">Frequently asked questions</h1>
        <p className="mt-2 max-w-xl text-sm text-[#5f6172]">Everything about wallets, voting, tickets, NFTs, and rewards. For wallet-safety details and verified project links, see the <Link href="/security" className="font-semibold text-[#a97f16] underline">Security page</Link>.</p>
      </header>

      {GROUPS.map((g) => (
        <section key={g.title}>
          <h2 className="mb-3 tracking-tight text-2xl font-semibold text-[#23252f]">{g.title}</h2>
          <div className="space-y-3">
            {g.items.map((qa) => <Item key={qa.q} qa={qa} />)}
          </div>
        </section>
      ))}

      <section id="legal" className="glass p-6">
        <h2 className="tracking-tight text-xl font-semibold text-[#23252f]">Terms & privacy</h2>
        <p className="mt-2 text-sm leading-relaxed text-[#5f6172]">
          CrownFi is a hackathon/testnet demonstration. It is not production voting infrastructure, not a mainnet financial
          application, and not a replacement for legal tabulation or compliance systems. Test assets and demo data are
          disposable. Do not submit sensitive personal information. By using CrownFi you accept that all on-chain actions occur
          on Stellar Testnet with no real-world value.
        </p>
        <div className="mt-4">
          <Link href="/" className="btn-ghost">Back to home</Link>
        </div>
      </section>
    </div>
  );
}
