# October 2026 UI correction

The correction keeps the requested homepage/UI improvements and personal drag rankings. It removes the V3 amendment work and new-schema requirements from the previous update.

## What stays

- Homepage introduction, voting/prediction buttons and preview of actual live Stellar markets.
- Personal Top 20/10/5/3 rankings with search, drag grips and arrow controls. Saves are **local to this browser/device**, separated by signed-in account and market. They do not sync across devices, create USDC positions, affect voting, or earn payouts. Clearing browser storage removes them.
- Real platform totals and public page views. Missing/loading data displays a dash, not fabricated zero totals. A visit-counter failure cannot break the other counters. Homepage counts refresh every 30 seconds.
- GCash footer-logo removal only. Existing payment configuration, purchase flows and deployed smart-contract routing remain unchanged.

## No contract deployment or schema migration

Do **not** deploy V3 or change the existing prediction contract variables for this UI update. The contract source, Prisma schema, market management and payment code are restored to their pre-update versions. The unused amendment endpoints and pending migration were removed. No production database or deployed contract was altered during this correction.

If the previous migration was independently applied, do not drop tables or run a destructive schema sync. Extra unused columns/tables can remain; this version does not depend on them.

## Page visits

The tracker is enabled in the root layout. Public route visits, including repeat visits, send anonymous events; admin/account/organizer-dashboard pages are excluded. Common bots are skipped and requests are rate-limited. Counts start when the corrected tracker successfully records visits; no historical total is invented.

The counter uses a separate `analytics:page-views:v1` metadata row in the **existing** `PlatformSettings` table. Payment configuration remains in `singleton` and is never changed by analytics. One parameterized atomic upsert increments the total across server instances. Only the total and 128 recent random event IDs are retained to suppress ordinary duplicate deliveries. No wallet address, IP, pathname history or user identity is stored. This is approximate traffic counting, not bot-proof analytics or unique-visitor counting.

Deploy the web update normally. There is no new environment variable and no migration command for this correction. Confirm `/api/stats` returns the existing platform totals and `/api/page-views` records visits after deployment; a site visit should increase the count within the cache/refresh interval.
