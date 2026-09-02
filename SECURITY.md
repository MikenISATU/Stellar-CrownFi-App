# Security policy

CrownFi is a Stellar Testnet demonstration. It is not production voting infrastructure and does not use real-value assets.

## Reporting a vulnerability

Email [napilanmileskenneth@gmail.com](mailto:napilanmileskenneth@gmail.com) with the subject `CrownFi security report`. Do not include private keys, recovery phrases, access tokens, personal information, or other live credentials.

Include the affected route or component, reproduction steps, expected impact, and a safe proof of concept when possible.

## Wallet safety

- CrownFi never asks for or stores a recovery phrase, seed phrase, or private key.
- Freighter wallet connections are pinned to Stellar Testnet.
- Wallet sign-in requires a short-lived challenge containing the address, canonical application origin, nonce, issue time, and expiry.
- Server routes verify the wallet signature before creating an HTTP-only session cookie.
- User transactions are prepared server-side and presented by Freighter or Privy for approval.
- Signed transaction confirmation verifies the expected source and transaction intent before submission.

## Supported version

Only the current `main` branch and its production deployment receive security fixes.

## Independent verification

The production hostname, blocklist timeline, remediation changes, and repeatable validation commands are documented in [`docs/security/phishing-false-positive-remediation.md`](docs/security/phishing-false-positive-remediation.md).
