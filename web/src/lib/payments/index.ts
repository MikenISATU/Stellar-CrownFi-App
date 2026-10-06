// Payment-provider abstraction. The app talks to this layer, never to a provider SDK
// directly, so providers can be swapped from the admin Payment Settings without refactoring.
//
// `testnet_usdc` is implemented today (buyer-signed USDC via the existing sale-splitter flow).
// The fiat-onramp providers are catalogued with their capabilities and wired later behind the
// same interface. Verify each provider's CURRENT PH/GCash + Stellar/USDC support before enabling.

export type PaymentCapabilities = {
  gcash: boolean;
  cards: boolean;
  usdc: boolean;
  fiatOnramp: boolean;
  kyc: boolean;
  stellar: boolean;
};

export type PaymentProviderMeta = {
  id: string;
  label: string;
  capabilities: PaymentCapabilities;
  implemented: boolean; // wired end-to-end today
  notes?: string;
};

export const PROVIDERS: PaymentProviderMeta[] = [
  {
    id: "testnet_usdc",
    label: "Testnet USDC (Stellar)",
    capabilities: { gcash: false, cards: false, usdc: true, fiatOnramp: false, kyc: false, stellar: true },
    implemented: true,
    notes: "Buyer-signed USDC via the sale-splitter. Default for development/testing.",
  },
  {
    id: "gcash",
    label: "GCash (third-party merchant)",
    capabilities: { gcash: true, cards: false, usdc: false, fiatOnramp: true, kyc: true, stellar: false },
    implemented: false,
    notes: "PH GCash merchant checkout. Testnet/demo only for now — you can enable or disable third-party payments here. A live GCash merchant account + webhook reconciliation is required before production.",
  },
  {
    id: "transak",
    label: "Transak",
    capabilities: { gcash: true, cards: true, usdc: true, fiatOnramp: true, kyc: true, stellar: true },
    implemented: false,
    notes: "Fiat→crypto onramp with GCash + cards + bundled KYC. Verify current PH + Stellar-asset support.",
  },
  {
    id: "alchemypay",
    label: "Alchemy Pay",
    capabilities: { gcash: true, cards: true, usdc: true, fiatOnramp: true, kyc: true, stellar: true },
    implemented: false,
    notes: "GCash + cards; verify Stellar/USDC rails for your region.",
  },
  {
    id: "moonpay",
    label: "MoonPay",
    capabilities: { gcash: false, cards: true, usdc: true, fiatOnramp: true, kyc: true, stellar: true },
    implemented: false,
    notes: "Cards + bank; strong KYC. GCash not native.",
  },
  {
    id: "ramp",
    label: "Ramp Network",
    capabilities: { gcash: false, cards: true, usdc: true, fiatOnramp: true, kyc: true, stellar: false },
    implemented: false,
    notes: "Cards/bank onramp; confirm Stellar support before relying on it.",
  },
];

export function getProviderMeta(id: string): PaymentProviderMeta {
  return PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0];
}

// The operations a concrete provider must implement (testnet_usdc maps to the existing
// prepare/confirm buy flow; onramp providers open a hosted widget + reconcile via webhook).
export interface PaymentProvider {
  meta: PaymentProviderMeta;
  // Returns either an on-chain intent (crypto) or a hosted-checkout URL (fiat onramp).
  createCheckout(input: {
    kind: "mint" | "ticket" | "vote" | "premium";
    amount: number;
    currency: string;
    buyerAddress?: string;
    reference?: string;
  }): Promise<{ mode: "onchain" | "redirect"; url?: string; intentId?: string }>;
}
