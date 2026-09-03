"use client";
import { ReactNode } from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { PrivySignerBridge } from "./PrivySignerBridge";

const APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

// Wraps the app in PrivyProvider ONLY when an App ID is configured. Without it, this is a
// transparent pass-through — the app behaves exactly as before (Freighter-only).
export function PrivyWrapper({ children }: { children: ReactNode }) {
  if (!APP_ID) return <>{children}</>;
  return (
    <PrivyProvider
      appId={APP_ID}
      config={{
        loginMethods: ["google", "email"],
        // Stellar wallets are provisioned server-side (chainType "stellar"); no EVM/SOL needed on login.
        embeddedWallets: {
          ethereum: { createOnLogin: "off" },
          solana: { createOnLogin: "off" },
        },
        appearance: { theme: "light", accentColor: "#d4af37", logo: "/brand/logo.png" },
      }}
    >
      <PrivySignerBridge />
      {children}
    </PrivyProvider>
  );
}
