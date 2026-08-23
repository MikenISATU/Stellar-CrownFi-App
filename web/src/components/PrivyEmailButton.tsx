"use client";
import { ReactNode } from "react";
import { usePrivy } from "@privy-io/react-auth";

// The "Continue with Email" chooser item. Opens the Privy login modal; the actual
// session exchange is handled by the persistent <PrivyAutoLink /> after auth completes.
export function PrivyEmailButton({ children, onStart }: { children: ReactNode; onStart?: () => void }) {
  const { ready, authenticated, login } = usePrivy();
  return (
    <button
      onClick={() => { onStart?.(); if (!authenticated) login(); }}
      disabled={!ready}
      className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition hover:bg-[#faf6ea] disabled:opacity-60"
    >
      {children}
    </button>
  );
}
