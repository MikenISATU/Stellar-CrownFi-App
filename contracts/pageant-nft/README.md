# pageant-nft — reusable pageant NFT template (Soroban)

One contract instance **per pageant**. Candidates are registered by the admin with a
configurable max supply + IPFS metadata (artwork on Pinata). Fans mint **one NFT per
candidate per wallet**. Adding a new pageant needs **no code changes** — just new candidate
config + artwork, then deploy a fresh instance from this template.

Self-contained on `soroban-sdk` only (no OpenZeppelin crates), so it builds cleanly and every
security property lives in one auditable file (`src/lib.rs`).

## Security (all enforced in `src/lib.rs`)
| Requirement | How |
|---|---|
| Authorization / access control | `admin.require_auth()` on admin fns; `to`/`from.require_auth()` on mint/transfer |
| Role-based permissions | single `admin` (owner) role |
| Emergency pause / unpause | `Paused` flag; blocks mint + transfer |
| Wallet mint restriction | `Minted(wallet, candidate)` — one per wallet per candidate (permanent → no mint/transfer/mint farming) |
| Max supply enforcement | `minted < max_supply` per candidate |
| Duplicate mint prevention | `AlreadyMinted` guard |
| Input validation | `InvalidSupply` (>0), `InvalidMetadata` (len 1..=300) |
| Metadata validation / immutability | validated on set; **frozen once minting starts** (`MintingStarted`) |
| Event logging | `init`, `cand_add`, `mint`, `transfer`, `pause`, `unpause`, `adminxfr` |
| Clear errors | `Error` enum (typed contract errors) |
| Secure ownership transfer | `transfer_admin` (admin-only, authed) |
| Gas/storage optimization | instance storage for config/counters; persistent for tokens; TTL bumped per call |

## Interface
- `initialize(admin, name, symbol)`
- `add_candidate(candidate_id, max_supply, metadata)` · `set_candidate_metadata(id, metadata)` *(pre-mint only)*
- `mint(to, candidate_id) -> token_id` · `transfer(from, to, token_id)`
- `pause()` · `unpause()` · `transfer_admin(new_admin)`
- views: `candidate`, `remaining`, `has_minted`, `owner_of`, `token_candidate`, `balance_of`, `total_supply`, `paused`, `admin`, `name`, `symbol`, `version`

## Build / test / deploy
```bash
cd contracts
cargo test -p pageant-nft            # unit tests (supply cap, duplicate mint, pause, …)
stellar contract build               # wasm → target/wasm32v1-none/release/pageant_nft.wasm
stellar contract deploy \
  --wasm target/wasm32v1-none/release/pageant_nft.wasm \
  --source alice --network testnet --alias pageant_nft_<slug>
# then, per pageant:
stellar contract invoke --id C... -- initialize --admin G... --name "<Pageant>" --symbol "<SYM>"
stellar contract invoke --id C... -- add_candidate --candidate_id 1 --max_supply 120 --metadata "ipfs://<cid>/1.json"
```

## New-pageant checklist (§5)
Only these change per pageant — never the contract code:
1. Candidate list + `max_supply`
2. Candidate NFT artwork → Pinata → `ipfs://…`
3. `initialize` name/symbol + `add_candidate` per candidate
4. Store the deployed contract id on the `Pageant` record (`nftContractId`)
