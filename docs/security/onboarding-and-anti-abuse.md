# Onboarding, Anti-Abuse & User Safety

Reference for the security / real-user measures added in **v0.2.0 (2026-07-11)**. Ordered by
priority, with the user-friendly error system first.

---

## 1. User-friendly error messages (single source of truth)

**File:** `web/src/lib/messages.ts`

The API speaks **stable machine codes** (`duplicate_vote`, `seat_taken`, `ip_registration_limit`,
`wallet_linked_elsewhere`, …). The UI never shows those codes — it translates them through
`messageFor(code, fallback)` in `messages.ts`.

```ts
import { messageFor } from "@/lib/messages";
flash(messageFor(err, "Could not record your vote."), "err");
```

**Why:** one place to edit copy, consistent wording everywhere, and a clean seam for i18n later
(swap the `ERROR_MESSAGES` map per locale).

**Rule:** servers return CODES, `messages.ts` returns HUMAN. Never send human copy from an API
route (it hardcodes language server-side and can leak internals).

**Wired into:** vote, collect, candidate mint, tickets (buy + seat), loyalty (task + redeem),
and the wallet sign-in flow (`SessionProvider`). To add a new message, add the code → string to
`ERROR_MESSAGES`. Unknown codes fall back to `DEFAULT_ERROR`; `balance`/`trustline`/`cancel`
substrings are handled specially.

---

## 2. Registration cap — max 2 accounts per IP

**Files:** `web/src/lib/ip.ts`, `web/src/app/api/fans/connect/route.ts`, `Fan.registrationIpHash`

On a **new** account sign-in, the server counts existing accounts whose `registrationIpHash`
matches this request and rejects with `ip_registration_limit` once the cap
(`MAX_ACCOUNTS_PER_IP`, default **2**) is reached. **Returning wallets are never capped.**

- IPs are **never stored raw** — only `sha256(secret + ip)` (`hashIp()`), so the value can't be
  reversed but still groups a network.
- Tune with `MAX_ACCOUNTS_PER_IP` in `web/.env`.

### Known limitations (important)
- **IP is a weak signal.** Offices, universities, mobile CGNAT, and VPNs share one IP — a strict
  cap can block legitimate users. Treat this as a *soft* layer on top of the wallet signature,
  which is the real sybil gate.
- **X-Forwarded-For is spoofable** without a trusted proxy. In production, pin `clientIp()` to your
  proxy's real-IP header.
- **Persistence:** the count is in Postgres (durable). If you move rate-limiting to Redis, mirror
  this there too. The in-memory `rateLimit()` helper is still demo-only.

---

## 3. "Wallet already linked to another account"

**Files:** `web/src/app/api/fans/link-wallet/route.ts`, `Fan.walletAddress @unique`, `Fan.email @unique`

A wallet maps to exactly one account (`@unique`). In the wallet-only flow that's inherently 1:1.
It becomes meaningful with **email/embedded-wallet accounts**: if a provisioned wallet already
belongs to a different email, the server returns `wallet_linked_elsewhere` →
*"This wallet is already linked to another CrownFi account. Sign in with it instead."*

The same guard also prevents creating a second account for an email that already exists.

---

## 4. KYC (money-out only)

**File:** `web/src/lib/kyc.ts`, `Fan.kycStatus` (`none | pending | verified | rejected`)

**Decision:** no KYC for voting or small buys — KYC applies only on the **money-out** path
(payouts / withdrawals), to minimise friction and PII exposure.

`kyc.ts` is a **gate only** — it reads `kycStatus` and returns `null` (ok), `kyc_pending`, or
`kyc_required`. It does **not** verify anyone. Verification is done by an external provider
(Persona / Sumsub / Onfido / Veriff) or a Stellar anchor's **SEP-12** flow; a provider webhook
flips `kycStatus` to `verified`. **No raw ID documents are stored in CrownFi** — only the status
(add a `kycRef` field when wiring a provider). Gate any future withdrawal route with `kycGate(fan)`.

---

## 5. Web2-friendly onboarding (Privy embedded wallets)

**Files:** `web/src/wallet/index.ts` (PrivyWallet adapter), `web/src/app/api/fans/link-wallet/route.ts`

Lets new users sign up with **email / Google / passkey** — no seed phrase, no browser extension.

### The EVM-first / Stellar question
> *"If using Privy, EVM (ETH) is created first — can we add parameters to push it to the DB then
> auto-create the Stellar wallet?"*

**Yes.** Privy's **default** embedded wallet is EVM. Stellar uses ed25519 keys, so a Stellar
address is **not** the same key and is **not** created just by enabling Google login. The flow:

1. User logs in with email / Google / passkey (Privy).
2. Privy provisions the default **EVM** embedded wallet.
3. We **explicitly** create a Stellar wallet with `createWallet({ chainType: "stellar" })`
   (see `PrivyWallet.ensureAddress` in `src/wallet/index.ts`).
4. The client posts that Stellar address to **`POST /api/fans/link-wallet`**, which pushes it to
   the DB (`Fan`, `authProvider: "privy"`), runs the wallet-already-linked check, and opens a session.

### Wiring steps
1. `npm i @privy-io/server-auth` and set `PRIVY_APP_ID` + `PRIVY_APP_SECRET` (server-only) in `web/.env`.
2. Set `WALLET_PROVIDER=privy`.
3. Store each fan's Privy user id on the `Fan` record at first login.
4. **Fee sponsorship (required):** Web2 users hold no XLM. Cover account creation + reserves +
   transaction fees with **sponsored reserves / fee-bump transactions** from the platform account
   so users never touch a token. This is the main piece of real work.
5. Serve over **HTTPS** in production (Privy key handling fails silently on plain http; localhost is exempt).

### Trade-offs
- Embedded wallets are managed-key (Privy splits shards in a TEE) vs Freighter's pure self-custody —
  the right call for mainstream fans, but be explicit about it.
- Keep **both** providers behind the same session model (Freighter for crypto-natives, Privy for
  everyone else) — the wallet abstraction already supports this.

---

## Environment variables added / used

| Var | Default | Purpose |
|---|---|---|
| `MAX_ACCOUNTS_PER_IP` | `2` | New accounts allowed per network (IP) |
| `PRIVY_APP_ID` / `PRIVY_APP_SECRET` | — | Privy embedded-wallet onboarding (server-only) |
| `WALLET_PROVIDER` | `mock` | `freighter` (client) / `privy` / `mock` |

## Database changes (v0.2.0)

New `Fan` fields (applied via `prisma db push`): `registrationIpHash`, `kycStatus`, `authProvider`,
plus an index on `registrationIpHash`. Backward-compatible (all nullable / defaulted).
