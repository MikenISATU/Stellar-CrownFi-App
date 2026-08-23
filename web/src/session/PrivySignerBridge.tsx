"use client";
import { useEffect } from "react";
import { useSignRawHash } from "@privy-io/react-auth/extended-chains";
import { setPrivySigner } from "@/wallet/privySigner";

// Exposes Privy's raw-hash signer (a React hook) to the non-React signTx() helper.
// Rendered only inside PrivyProvider, so the hook is always in a valid context.
export function PrivySignerBridge() {
  const { signRawHash } = useSignRawHash();
  useEffect(() => {
    setPrivySigner(signRawHash as any);
    return () => setPrivySigner(null);
  }, [signRawHash]);
  return null;
}
