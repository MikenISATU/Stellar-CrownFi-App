# CrownFi — Update v0.2.0

**Date:** 2026-07-11
**Theme:** Real-user safety, anti-abuse, and Web2-friendly onboarding groundwork.

Full reference: [`docs/security/onboarding-and-anti-abuse.md`](../../security/onboarding-and-anti-abuse.md)

---

## Added

### 1. User-friendly error messages (single source of truth) — priority
- New `web/src/lib/messages.ts` — `ERROR_MESSAGES` map + `messageFor(code, fallback)`.
- API keeps returning stable machine **codes**; the UI translates them to human copy in one file.
- Refactored inline error mappings across **vote**, **collect**, **candidate mint**, **tickets
  (buy + seat)**, **loyalty (task + redeem)**, and **wallet sign-in** to use `messageFor`.

### 2. Registration cap — 2 accounts per IP
- `Fan.registrationIpHash` (salted SHA-256, never raw IP) + index.
- `web/src/lib/ip.ts` → `hashIp()` / `clientIpHash()`.
- `POST /api/fans/connect` enforces `MAX_ACCOUNTS_PER_IP` (default 2) on **new** accounts;
  returning wallets are never capped. New code: `ip_registration_limit`.

### 3. "Wallet already linked to another account"
- New `POST /api/fans/link-wallet` (email/embedded-wallet path) returns `wallet_linked_elsewhere`
  with a friendly notice when a wallet or email already belongs to a different account.
- Backed by existing `Fan.walletAddress @unique` / `Fan.email @unique`.

### 4. KYC gate scaffold (money-out only)
- `Fan.kycStatus` (`none | pending | verified | rejected`).
- `web/src/lib/kyc.ts` → `kycGate(fan)` / `isKycVerified(fan)`. Gate only — verification is done by
  an external provider (Persona/Sumsub/Onfido) or Stellar **SEP-12**; a webhook flips the status.
  No raw ID documents stored.

### 5. Web2-friendly onboarding (Privy)
- `Fan.authProvider` (`freighter | privy | mock`).
- `PrivyWallet` adapter (`src/wallet/index.ts`) documents the **EVM-first → explicit Stellar
  wallet** (`chainType: "stellar"`) provisioning; `/api/fans/link-wallet` pushes it to the DB.
- Documented wiring + the **fee-sponsorship** requirement (Web2 users hold no XLM).

## Changed
- `web/package.json` version → `0.2.0`.

## Database (apply with `npx prisma db push`)
- `Fan`: `+registrationIpHash`, `+kycStatus`, `+authProvider`, `+@@index([registrationIpHash])`.
- Backward-compatible (nullable / defaulted). Already pushed to the configured Supabase DB.

## Environment
- `MAX_ACCOUNTS_PER_IP` (default `2`), optional.
- `PRIVY_APP_ID` / `PRIVY_APP_SECRET` for the Privy path (server-only).

## Not changed / still open (product decisions)
- Live KYC provider selection + webhook.
- Privy SDK install + fee sponsorship infrastructure.
- Moving IP counters / rate-limits to Redis for multi-instance deploys.
- Trusted-proxy IP pinning (X-Forwarded-For hardening).

## Verification
- `npx tsc --noEmit` — clean.
- `npx prisma db push` — schema in sync with Supabase.
