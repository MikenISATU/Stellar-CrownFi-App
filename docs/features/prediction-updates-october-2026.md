# October 2026 prediction updates

These updates apply to the Stellar application. No Base/Solana integration or video recording is included.

## Included changes

- Homepage voting/prediction actions and the requested platform introduction.
- A vertical, fixed-height preview of actual open, unexpired markets. It refreshes every 30 seconds, supports manual scrolling and pause/resume, and respects reduced-motion preferences. No example markets are inserted into the database.
- Public page-view counts (not unique visitors). Counting starts with this release; there is no historical backfill. Repeat visits count; duplicate delivery of the same event does not. The tracker stores only event ID, public path and timestamp, excludes private/admin pages and ignores common bot user agents. Counts are approximate, not bot-proof analytics.
- Personal Top 20/10/5/3 rankings saved per signed-in account and market. Candidate search, touch/mouse drag grips and arrow controls support reordering. These are personal picks, not escrowed bets or ranked payouts. Rankings lock when a market closes; changed candidate labels require affected rankings to be rebuilt.
- One category/stage plus up to eight tags, including custom tags. The market list supports tag filtering.
- Creators/admins can append outcomes and extend the close time on compatible open markets. Existing outcome labels, flags, order and stakes remain unchanged. On-chain changes are authorized by the configured contract admin after the application verifies creator/admin ownership.
- New GCash checkout is disabled, its footer logo is removed, and GCash providers cannot be selected. The webhook remains available to reconcile payments initiated before the change.

## Required rollout (not performed by the code change)

1. Back up the database and apply the included migration from `web` with `npx prisma migrate deploy`. It adds tags, a pending-amendment journal, personal rankings and page-view storage. Apply it before serving the updated application.
2. Run `npm run check`, `npm run build` in `web`, and `cargo test -p prediction-market` in `contracts`.
3. For on-chain amendments, deploy and initialize the new prediction-market contract using the existing deployment procedure. Record its real Contract Address and deployment transaction hash after deployment; none are invented here.
4. Set the server-side Vercel variable `PREDICTION_MARKET_CONTRACT_ID_V3` to that new `C...` Contract Address, then redeploy. Do not use a WASM hash or an old V1/V2 address. Keep the old variables for historical markets. The app prefers V3 for new markets and retains each existing market's recorded contract reference.
5. Verify a new testnet market end-to-end: stake, append an option, extend its deadline, stake on the appended option, and settle or cancel/refund. Local tests do not replace this deployed-wallet check.

Existing contracts have no upgrade entry point. Their markets cannot gain amendment support by changing an environment variable, and existing escrow is not migrated. They remain readable/settleable on their original contract. Database-only mock markets can be amended without a chain deployment.

## Interrupted amendments

The API locks the market and persists the intended option list/deadline before submission. An uncertain chain response or database confirmation leaves it in `amending`, blocks other management changes/staking, and exposes a retry action to its creator/admin. Retrying submits the same idempotent contract operation. Do not manually reset a pending market without checking its on-chain state. A permanently rejected amendment (for example, expiry before submission) requires administrator reconciliation; it must not silently overwrite chain-backed terms.

## Verification limits

Automated route tests use in-memory database fixtures; they do not migrate a database, send payments or submit chain transactions. Browser fixture checks verify component interactions and layout, not wallet authorization or deployed settlement. Contract unit tests run in the Soroban test environment. Production migration and testnet smoke tests remain rollout steps.
