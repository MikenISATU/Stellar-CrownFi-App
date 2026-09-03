"use client";
import { ReactNode } from "react";
import { usePrivy } from "@privy-io/react-auth";

type PrivyLoginMethod = "google" | "email";

// Opens Privy's login modal with only the selected method. The actual session exchange
// is handled by the persistent <PrivyAutoLink /> after authentication completes.
export function PrivyLoginButton({
  children,
  method,
  onStart,
}: {
  children: ReactNode;
  method: PrivyLoginMethod;
  onStart?: () => void;
}) {
  const { ready, authenticated, login } = usePrivy();
  return (
    <button
      type="button"
      onClick={() => {
        onStart?.();
        if (!authenticated) login({ loginMethods: [method] });
      }}
      disabled={!ready}
      className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition hover:bg-[#faf6ea] disabled:opacity-60"
    >
      {children}
    </button>
  );
}
