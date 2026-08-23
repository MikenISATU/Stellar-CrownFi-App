# Payments & KYC — recommendations (Phase 3)

Answers to the §6 questions, plus how the implemented abstraction works.

## What was built (abstraction + admin controls)
- **`PlatformSettings`** (single admin-edited row): `paymentsEnabled`, `kycEnabled`, `kycMandatory`,
  `environment` (testnet/production), `activeProvider`, `maintenanceMode`.
- **Provider abstraction** (`web/src/lib/payments/`): the app talks to one interface; providers are a
  catalog with capability flags. **`testnet_usdc`** is wired today (buyer-signed USDC via the
  sale-splitter); onramp providers are catalogued and swap in behind the same interface — **no
  refactor to change provider**.
- **Admin → Payments tab**: toggle payments/KYC/maintenance, pick environment + provider (with a
  capability matrix), and view payment/KYC logs (`PaymentLog`, `KycLog`).
- **KYC gate** (`web/src/lib/kyc.ts`): `kycGate(fan)` returns `kyc_required | kyc_pending | null`,
  ready to guard paid actions when `kycEnabled` is on. Verification itself is done by the provider /
  SEP-12; a webhook flips `Fan.kycStatus`.

## 1. Should KYC be mandatory for financial transactions?
**No — not globally. Make it configurable and gated by amount/action.**
- **Never** for browse or registration (keeps it Web2-friendly — already enforced).
- **Optional/soft** for small NFT mints and paid votes (fraud risk is low; friction kills conversion).
- **Mandatory** only on the **money-OUT** side (payouts/withdrawals) and above a spend threshold.
- The `kycEnabled` + `kycMandatory` toggles let you dial this per environment without a deploy.

## 2. Most suitable payment providers (Stellar + PH/GCash)
Verify each provider's **current** PH/GCash + Stellar-asset support before enabling (support moves):
- **Transak** — strongest fit: GCash + cards + fiat→USDC + bundled KYC, multi-chain incl. Stellar.
- **Alchemy Pay** — GCash + cards; confirm Stellar/USDC rails for your region.
- **MoonPay** — cards/bank + strong KYC; GCash not native.
- **Stellar anchors (SEP-24/SEP-6)** + **MoneyGram Access** — native Stellar cash-in/out.
- Most onramps **bundle KYC**, so the onramp often *is* your KYC provider (else Sumsub/Persona).

Recommended path: **testnet USDC now → Transak (or Alchemy Pay) for PH GCash + cards at launch**,
behind the existing abstraction.

## 3. Best onboarding for Web2 + Web3
- Web2: email/Google via Privy → embedded Stellar wallet (Phase 2 groundwork) → pay with GCash/card
  via the onramp; user never sees a seed phrase or holds XLM (**sponsor fees**).
- Web3: connect Freighter and pay in USDC directly.
- Keep both behind one session model + one payment interface (done).

## 4. Security best practices
- Never expose provider **secrets** to the client (server-only; webhooks verified by signature).
- Idempotent settlement + a `PaymentLog` per attempt (added) to reconcile onramp webhooks.
- KYC: store only **status + provider reference**, never raw ID documents; PII off-chain.
- Rate-limit + audit paid endpoints; verify amounts server-side (never trust client amounts).

## 5. Scalability
- Provider abstraction means new providers/regions are config, not code.
- Move in-memory rate-limits/intents to Redis before multi-instance (already flagged).
- `PaymentLog`/`KycLog` are indexed by time for the admin monitor + future analytics.

## Next steps to go live on payments
1. Pick + create a provider account (Transak/Alchemy Pay), add its keys server-side.
2. Implement its `PaymentProvider.createCheckout` (hosted widget + webhook → `PaymentLog`).
3. Turn on `kycEnabled` where you want it and wire the provider's KYC webhook → `Fan.kycStatus`.
4. Gate the chosen paid actions with `kycGate(fan)` + the `paymentsEnabled`/`maintenanceMode` flags.
