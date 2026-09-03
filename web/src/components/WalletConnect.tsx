"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "@/session/SessionProvider";
import { Icons } from "./icons";
import { FreighterMark, GoogleMark } from "./brandIcons";
import { short } from "@/lib/format";
import { PrivyAutoLink } from "./PrivyAutoLink";
import { PrivyLoginButton } from "./PrivyEmailButton";

const PRIVY_ENABLED = Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID);

// Single entry point for connecting. Signed out → a "Connect Wallet" button that opens a
// chooser (Freighter or Email/Privy, each with an icon). Signed in → the account chip + menu.
export function WalletConnect() {
  const { fan, address, isAdmin, connect, disconnect, connecting } = useSession();
  const [chooser, setChooser] = useState(false);
  const [menu, setMenu] = useState(false);

  // Let contextual CTAs (notably the mobile prediction card) open the same trusted
  // connection chooser instead of hard-wiring themselves to a desktop-only wallet.
  useEffect(() => {
    const open = () => setChooser(true);
    window.addEventListener("crownfi:open-connect", open);
    return () => window.removeEventListener("crownfi:open-connect", open);
  }, []);

  // ── Connected: account chip + menu ──
  if (address) {
    return (
      <div className="relative">
        {PRIVY_ENABLED && <PrivyAutoLink />}
        <button
          onClick={() => setMenu((m) => !m)}
          className="flex items-center gap-2 rounded-full border border-[#e7e2d3] bg-white px-2.5 py-1.5 text-sm transition hover:border-[#c9a227]"
          aria-label="Account"
        >
          <span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-b from-[#d4af37] to-[#b8912f] text-[#1a1f35]">
            <Icons.Wallet size={14} strokeWidth={2} />
          </span>
          <span className="max-w-[130px] truncate text-[#3a3f52]">{short(address, 4)}</span>
        </button>
        {menu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenu(false)} />
            <div className="absolute right-0 z-50 mt-2 w-64 glass p-3 text-sm shadow-[0_20px_50px_-24px_rgba(120,100,40,0.4)]">
              <div className="mb-2 rounded-xl surface-soft px-3 py-2">
                <div className="text-xs text-[#7a7768]">Connected</div>
                <div className="mono text-[#23252f]">{short(address, 6)}</div>
                {fan && <div className="mt-1 text-xs text-[#a97f16]">{fan.points} loyalty points</div>}
                {isAdmin && <div className="mt-1 inline-block rounded-full bg-[#faf0d2] px-2 py-0.5 text-[11px] font-semibold text-[#8a6d1f]">Admin wallet</div>}
              </div>
              <button onClick={() => { setMenu(false); connect(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-[#3a3f52] hover:bg-[#faf6ea]">
                <Icons.Repeat size={14} strokeWidth={2} /> Switch wallet
              </button>
              <button onClick={() => { disconnect(); setMenu(false); }} className="mt-0.5 w-full rounded-lg px-3 py-1.5 text-left text-[#3a3f52] hover:bg-[#faf6ea]">Disconnect</button>
            </div>
          </>
        )}
      </div>
    );
  }

  // ── Signed out: Connect Wallet + chooser ──
  return (
    <div className="relative">
      {/* Persistent Privy linker so post-login token exchange still runs after the chooser closes. */}
      {PRIVY_ENABLED && <PrivyAutoLink />}
      <button
        onClick={() => setChooser((c) => !c)}
        disabled={connecting}
        className="flex items-center gap-2 rounded-full border border-[#e7e2d3] bg-white px-3 py-1.5 text-sm transition hover:border-[#c9a227] disabled:opacity-60"
        aria-label="Connect Wallet"
      >
        <span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-b from-[#d4af37] to-[#b8912f] text-[#1a1f35]">
          <Icons.Wallet size={14} strokeWidth={2} />
        </span>
        <span className="text-[#3a3f52]">{connecting ? "Connecting…" : "Connect Wallet"}</span>
      </button>

      {chooser && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setChooser(false)} />
          <div className="absolute right-0 z-50 mt-2 w-72 glass p-2 shadow-[0_20px_50px_-24px_rgba(120,100,40,0.4)]">
            <div className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#7a7768]">Choose how to connect</div>

            {/* Freighter */}
            <button
              onClick={() => { setChooser(false); connect(); }}
              className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition hover:bg-[#faf6ea]"
            >
              <FreighterMark className="h-9 w-9 shrink-0 rounded-lg" />
              <span>
                <span className="block text-sm font-semibold text-[#23252f]">Freighter</span>
                <span className="block text-xs text-[#7a7768]">Stellar browser wallet</span>
              </span>
            </button>

            {/* Privy social login — Google is the primary passwordless path. */}
            {PRIVY_ENABLED && (
              <>
                <PrivyLoginButton method="google" onStart={() => setChooser(false)}>
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white ring-1 ring-[#e7e2d3]">
                    <GoogleMark />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-[#23252f]">Continue with Google</span>
                    <span className="block text-xs text-[#7a7768]">Sign in without a browser wallet</span>
                  </span>
                </PrivyLoginButton>
                <PrivyLoginButton method="email" onStart={() => setChooser(false)}>
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#fffaf0] text-[#9b7415] ring-1 ring-[#e7e2d3]">
                    <Icons.Mail size={18} strokeWidth={1.8} />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-[#23252f]">Continue with email</span>
                    <span className="block text-xs text-[#7a7768]">Use a one-time verification code</span>
                  </span>
                </PrivyLoginButton>
              </>
            )}

            <div className="mx-1 mt-1 rounded-xl border border-[#eadcae] bg-[#fffaf0] px-3 py-2.5 text-xs leading-relaxed text-[#6b5410]">
              <b>Testnet safety:</b> CrownFi never asks for a recovery phrase or private key. Review every message and transaction in your wallet before approving.{" "}
              <Link href="/security" onClick={() => setChooser(false)} className="font-semibold underline underline-offset-2">Learn more</Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
