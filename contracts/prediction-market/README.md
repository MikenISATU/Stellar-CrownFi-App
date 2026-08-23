# prediction-market — pageant prediction market (Soroban)

Polymarket-style, **pageant-only**. Admin creates markets (e.g. "Who wins the Swimsuit
Competition?") with N options; users stake USDC on an option; stakes are **escrowed** in the
contract; after the event the admin **resolves** the winner and winners **claim** a pro-rata
share of the whole pool (minus an optional platform fee). Self-contained on `soroban-sdk`.

⚠️ This contract **handles funds** — get an external security review before mainnet.

## Model
- `create_market(question, category, num_options, close_time)` → market id (admin)
- `stake(from, market_id, option, amount)` — escrows USDC (buyer-authorized); blocked after
  `close_time` and while paused
- `resolve_market(market_id, winning_option)` — admin, one-way; rejected if the winning option
  has zero stake (funds would lock → cancel instead)
- `claim(from, market_id)` → `stake × total_pool ÷ winning_pool − fee` (double-claim guarded)
- `cancel_market` + `refund(from, market_id)` — full refunds for voided markets
- admin: `pause` / `unpause` / `set_fee` / `transfer_admin`
- views: `market`, `pool_of`, `position_of`, `has_claimed`, `market_count`, `paused`, `admin`

## Security (verified by `cargo test -p prediction-market`)
| Property | Test |
|---|---|
| Pro-rata payout correctness | `full_market_flow_prorata` ✓ |
| Platform fee → treasury | `fee_goes_to_treasury` ✓ |
| No staking after close (anti-manipulation) | `no_stake_after_close` ✓ |
| Cancel → refund, no double refund | `cancel_then_refund` ✓ |
| Emergency pause | `pause_blocks_staking` ✓ |
| No-winner-stake resolve rejected (no locked funds) | `resolve_with_no_winner_stake_rejected` ✓ |

Plus: admin-only settlement (`admin.require_auth`), staker-authorized stakes/claims, double-claim
guard, overflow-checked i128 math, typed errors, events on every state change.

## Categories
Markets are tagged by `category` (free string) — reuse the platform categories:
`swimsuit`, `long_gown`, `overall`, `talent`, `costume`, … Add a new category with no code change.

## Deploy
See `contracts/DeploySC.md` (needs the USDC/SAC contract id + a treasury address at `initialize`).
