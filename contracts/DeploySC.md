# DeploySC — Smart Contract Deployment (Stellar Soroban)

Deployment runbook for the CrownFi platform contracts: the reusable **pageant-nft** template
(one instance per pageant) and the **prediction-market** contract.

## ✅ Already deployed (testnet, 2026-07-12) — in `web/.env`
| Contract | ID |
|---|---|
| Prediction Market | `CDF3R2LUIZJUXCFUBXP62F25M2BYUJT6OT3QYR46MWWBUFEXEAY25POO` |
| Prediction Market V2 (admin-assisted refunds) | `CATV2RPFRMSVMBEJSXQ4SREUOHZ45WJ2F657IQMVYH3CFKB5XZPBVVX7` |
| Pageant NFT | `CCONZKTIQHR5UE4AKROICICZ2JSWDAXYBNYDCKDIMRFSIK37PND5PMQW` |
| Prediction treasury | `GC3PXGAWQWHHV6M6AKR3LSZZ7RNYZXASGNJM7BSU3EMWI5KG2R5QSIY3` |

Both are **deployed + initialized**. Steps below reproduce/extend this.

> ⚠️ **Network flag gotcha:** the `--network testnet` alias on this machine was missing its
> passphrase (`rpc-url is used but network passphrase is missing`). Use **explicit flags**
> instead (as done in the real deploy):
> ```bash
> --rpc-url https://soroban-testnet.stellar.org \
> --network-passphrase "Test SDF Network ; September 2015"
> ```
> Or configure the alias once: `stellar network add testnet --rpc-url <rpc> --network-passphrase "<pass>"`.

---

## 0. Prerequisites (one-time)

```bash
# Rust + wasm target
rustup target add wasm32v1-none          # (older toolchains: wasm32-unknown-unknown)

# Stellar CLI
cargo install --locked stellar-cli

# A funded testnet identity (Friendbot funds it for free)
stellar keys generate alice --network testnet --fund
stellar keys address alice                # prints the platform G... address
```

The identity you deploy with becomes the contract **admin/owner** (mint authority + pause).
Keep its secret safe — it is the same key used as `STELLAR_PLATFORM_SECRET` in `web/.env`.

---

## 1. Build the contracts

```bash
cd contracts
cargo test -p pageant-nft                 # verify (6 tests: supply cap, 1-per-wallet, pause, …)
stellar contract build                    # → target/wasm32v1-none/release/pageant_nft.wasm
```

---

## 2. Install the wasm once (reused by every pageant)

Installing uploads the code and returns a **wasm hash**. Every future pageant deploys a fresh
instance from this same hash — no rebuild per pageant.

```bash
stellar contract upload \
  --wasm target/wasm32v1-none/release/pageant_nft.wasm \
  --source alice --network testnet
# → prints WASM_HASH (hex). Save it (e.g. PAGEANT_NFT_WASM_HASH in web/.env).
```

---

## 3. Deploy + configure ONE pageant

Do this per approved pageant (or wire it into deploy-on-approval later).

```bash
# 3a. Deploy an instance from the installed hash
stellar contract deploy \
  --wasm-hash <WASM_HASH> \
  --source alice --network testnet --alias pageant_<slug>
# → prints CONTRACT_ID (C...). Store it on the Pageant record (nftContractId).

# 3b. Initialize (admin = platform account)
stellar contract invoke --id <CONTRACT_ID> --source alice --network testnet -- \
  initialize --admin $(stellar keys address alice) --name "<Pageant Name>" --symbol "<SYM>"

# 3c. Register each candidate (candidate_id, max supply, IPFS metadata from Pinata)
stellar contract invoke --id <CONTRACT_ID> --source alice --network testnet -- \
  add_candidate --candidate_id 1 --max_supply 120 --metadata "ipfs://<cid>/1.json"
stellar contract invoke --id <CONTRACT_ID> --source alice --network testnet -- \
  add_candidate --candidate_id 2 --max_supply 120 --metadata "ipfs://<cid>/2.json"
# … repeat for all 5 candidates
```

> `--candidate_id` should match the CrownFi `Candidate` row (store the mapping so the mint
> page can call `mint(to, candidate_id)`).

---

## 4. Verify

```bash
stellar contract invoke --id <CONTRACT_ID> --network testnet -- candidate --candidate_id 1
stellar contract invoke --id <CONTRACT_ID> --network testnet -- remaining --candidate_id 1
stellar contract invoke --id <CONTRACT_ID> --network testnet -- paused
```

A fan mint (buyer-signed) is `mint --to G... --candidate_id 1` — this is what the mint page
submits via Freighter/Privy.

---

## 5. Wire it into the app

Store the deployed id on the pageant so the app can mint against it:

```sql
-- (or via the admin UI once deploy-on-approval is wired)
update "Pageant" set "nftContractId" = 'C...' where slug = '<slug>';
```

Then the candidate mint page calls `mint(buyer, candidate_id)` on `nftContractId`, buyer-signed.

---

## 6. Emergency controls (admin only)

```bash
stellar contract invoke --id <CONTRACT_ID> --source alice --network testnet -- pause
stellar contract invoke --id <CONTRACT_ID> --source alice --network testnet -- unpause
stellar contract invoke --id <CONTRACT_ID> --source alice --network testnet -- \
  transfer_admin --new_admin G...   # secure ownership transfer (e.g. to a multisig)
```

**Production hardening:** set the admin to a **multisig** account (not a single hot key), run the
OpenZeppelin Soroban security detector + a light external review before mainnet, and only touch
mainnet after that pass. Deploy target is testnet throughout development.

---

## prediction-market

Handles funds (USDC escrow) — **external security review required before mainnet.**

```bash
cd contracts
cargo test -p prediction-market            # 6 tests: payout math, fee, close, cancel/refund, pause
stellar contract build                     # → target/wasm32v1-none/release/prediction_market.wasm

stellar contract deploy \
  --wasm target/wasm32v1-none/release/prediction_market.wasm \
  --source alice --network testnet --alias prediction_market
# initialize with the USDC (SAC) contract id + a treasury address + fee bps (<=1000 = 10%)
stellar contract invoke --id C... --source alice --network testnet -- \
  initialize --admin $(stellar keys address alice) \
             --token <USDC_TEST_CONTRACT_ID> \
             --treasury <TREASURY_G...> --fee_bps 200
```

Then per market (admin):
```bash
stellar contract invoke --id C... --source alice --network testnet -- \
  create_market --question "Who wins the Swimsuit Competition?" --category "swimsuit" \
                --num_options 5 --close_time <unix_ts>
# users stake / claim buyer-signed from the app; admin resolves after the event:
stellar contract invoke --id C... --source alice --network testnet -- \
  resolve_market --market_id 1 --winning_option 2
```

Keep `PREDICTION_MARKET_CONTRACT_ID` for legacy markets and store the refund-capable
contract as `PREDICTION_MARKET_CONTRACT_ID_V2`. New market rows encode the contract id
with their creation transaction, so v1 positions continue using v1 while new markets use v2.
