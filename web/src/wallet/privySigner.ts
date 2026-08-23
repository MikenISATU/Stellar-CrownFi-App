"use client";

// Bridge between Privy's useSignRawHash hook (only callable inside React) and the plain
// async signTx() helper the purchase/stake flows call. PrivySignerBridge (mounted under
// PrivyProvider) registers the hook's function here; signTx reads it.

export type PrivyRawSigner = (input: {
  address: string;
  chainType: "stellar";
  hash: `0x${string}`;
}) => Promise<{ signature: `0x${string}` }>;

let signer: PrivyRawSigner | null = null;

export function setPrivySigner(fn: PrivyRawSigner | null) {
  signer = fn;
}

export function getPrivySigner(): PrivyRawSigner | null {
  return signer;
}
