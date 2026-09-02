# CrownFi phishing false-positive remediation

Last updated: 2026-09-03

## Scope and ownership

- Official deployment: `https://stellar-crown-fi-ap-jr77.vercel.app/`
- Public source: `https://github.com/MikenISATU/Stellar-CrownFi-Ap`
- Application: open-source Stellar Testnet demonstration; no mainnet or real-value assets
- Wallet providers: the official Freighter API and optional Privy authentication

CrownFi never asks for or stores a recovery phrase, seed phrase, private key, or wallet password.

## Blocklist timeline

The exact hostname was absent from MetaMask's `eth-phishing-detect` configuration at commit `c95621513e5ea80370ab9df9d4649f14f137c06e` (2026-08-26 17:11:28 UTC). It first appeared three minutes later in automated synchronization commit `d5f88c9c09419cdb7d46d52e9efe57c343018e6b`, pull request `#287320`, authored by `security-alliance-bot`.

The synchronization pull request does not publish a malicious URL path, captured credential form, transaction hash, impersonated brand, malware sample, or reporter evidence for this hostname. ChainPatrol's lookup reports the exact Vercel subdomain as blocked while the parent `vercel.app` asset is allowed. This is consistent with a hostname-specific report, not a platform-wide Vercel block.

References:

- MetaMask synchronization PR: `https://github.com/MetaMask/eth-phishing-detect/pull/287320`
- First blocklist commit: `https://github.com/MetaMask/eth-phishing-detect/commit/d5f88c9c09419cdb7d46d52e9efe57c343018e6b`
- ChainPatrol lookup: `https://app.chainpatrol.io/search?content=https%3A%2F%2Fstellar-crown-fi-ap-jr77.vercel.app%2F`

## Repository and deployment audit

The repository history and active source were checked for committed Stellar secret keys, recovery phrases, database credentials, access tokens, and real-looking secrets. No live secret or wallet-recovery material was found. Environment files are ignored; `.env.example` contains placeholders only.

The wallet chooser identifies Freighter and Privy. Wallet sign-in uses a uniquely generated, short-lived challenge. The server reconstructs the expected message and verifies its signature, address, expiry, and canonical application origin before issuing an HTTP-only session. Transaction confirmation validates the server-prepared intent and expected source account. Challenge replay protection remains process-local in this testnet MVP and must move to shared storage before production scaling.

The dependency tree was upgraded and re-locked. The deprecated `@privy-io/server-auth` package was replaced by `@privy-io/node`. Both the complete and production-only npm audits report zero known vulnerabilities at moderate severity or higher.

## Remediation completed

- Added a restrictive Content Security Policy and standard HSTS, anti-framing, MIME-sniffing, referrer, cross-domain-policy, and permissions headers.
- Added same-origin enforcement for unsafe browser API requests.
- Bound wallet challenge text to a server-derived canonical origin and reject signed but altered messages.
- Made PayMongo webhook validation fail closed when its signing secret is absent and reject stale signatures.
- Removed raw third-party authentication errors and user-identifying debug logs from client-visible/server logs.
- Decode and re-encode accepted uploads as WebP; reject GIF and unsupported formats; add rate limits and defensive image response headers.
- Removed nonfunctional social links and a simulated newsletter subscription message.
- Added `/security`, `/.well-known/security.txt`, `/robots.txt`, and `/sitemap.xml`.
- Added regression tests for challenge integrity, origin enforcement, and webhook fail-closed behavior.

## Reproduce the checks

From `web/`:

```bash
npm ci
npm audit --audit-level=moderate
npm audit --audit-level=moderate --omit=dev
npm run check
npm run build
```

Expected result: both audits report zero vulnerabilities; type checking, Merkle tests, security regression tests, and the production build pass.

## Removal request

The maintainers request human review and removal of the official hostname from ChainPatrol, SEAL, and MetaMask blocklists. If a provider has non-public incident evidence, please share a sanitized indicator, affected path, or timestamp with the repository owner so it can be investigated and remediated.
