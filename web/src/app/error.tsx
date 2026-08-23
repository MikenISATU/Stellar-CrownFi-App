"use client";
import { useEffect } from "react";

// Branded error boundary — a crash shows this instead of a blank white stack screen.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("[app error]", error); }, [error]);
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/logo.png" alt="CrownFi" className="h-14 w-14 object-contain opacity-80" />
      <h1 className="mt-5 tracking-tight text-3xl font-semibold text-[#23252f]">Something went <span className="font-display italic text-[#c8a233]">wrong</span></h1>
      <p className="mt-2 text-sm text-[#5f6172]">The page hit an unexpected error. Your wallet and any on-chain activity are unaffected.</p>
      <div className="mt-6 flex gap-3">
        <button className="btn-gold" onClick={reset}>Try again</button>
        <a href="/" className="btn-ghost">Back to home</a>
      </div>
    </div>
  );
}
