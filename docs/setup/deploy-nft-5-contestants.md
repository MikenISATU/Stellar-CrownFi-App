# Deploy the NFT collection for the 5 current contestants (Pinata + `pageant-nft`)

A do-it-now runbook to publish the 5 contestant NFTs on the deployed **`pageant-nft`** contract
with **Pinata (IPFS)** metadata. Config for this drop:

| Setting        | Value                                             |
| -------------- | ------------------------------------------------- |
| Price          | **50 USDC** (already set on each collectible)      |
| Supply         | **Unlimited** (contract needs a positive cap → use `1000000`) |
| Per wallet     | **One mint per wallet per candidate** (enforced on-chain) |
| Payment (test) | Testnet USDC + **GCash** third-party merchant (see §5) |

**Deployed IDs (testnet)**

```
PAGEANT_NFT_CONTRACT_ID = CCVLW74KKI7NPWORVMI474RNOROF5LKTRCDCUB6FHZ47CGCL3BCWGMMZ   (already initialized)
Admin key (source)      = alice  →  GAKCSKNKNMXTYBRWL7MNR4J5UGWP7CL2EJGKVWWCWHMYI36B3TKN5NNX
RPC / passphrase        = https://soroban-testnet.stellar.org  /  "Test SDF Network ; September 2015"
```

The 5 contestants (candidate_id → art in `web/public/nfts/`):

| candidate_id | Delegate       | Country      | Image             |
| ------------ | -------------- | ------------ | ----------------- |
| 1            | Ayu Lestari    | Indonesia    | `indonesia.webp`  |
| 2            | Isabel Reyes   | Philippines  | `philippines.webp`|
| 3            | Linh Nguyen    | Vietnam      | `vietnam.webp`    |
| 4            | Mai Tanaka     | Japan        | `japan.webp`      |
| 5            | Ratana Somsri  | Thailand     | `thailand.webp`   |

Ready-to-pin metadata files are already generated at **`contracts/pageant-nft/metadata/1.json … 5.json`**
(they reference the image by filename — you only fill in the image CID in step 1).

---

## 1. Pinata — one image + one JSON per NFT

Create a free **pinata.cloud** account. Then, **for each of the 5 contestants**, do this:

1. **Upload the image** (e.g. `web/public/nfts/philippines.webp` for Isabel) → Pinata gives it a **CID**.
   Its link is `ipfs://<that CID>`.
2. **Open that contestant's JSON** (`contracts/pageant-nft/metadata/2.json` for Isabel = candidate 2) and
   replace `<IMAGE_CID>` with the image CID from step 1 → `"image": "ipfs://<that CID>"`.
3. **Upload that JSON** to Pinata → it gets its **own CID**. That is the NFT's metadata link:
   `ipfs://<the JSON's CID>` — this is what you paste into `add_candidate` in §2.

Repeat for all 5 (candidate 1 = Ayu/Indonesia, 2 = Isabel/Philippines, 3 = Linh/Vietnam, 4 = Mai/Japan, 5 = Ratana/Thailand).

> Shortcut if you'd rather do 2 uploads instead of 10: pin the whole `web/public/nfts/` folder (one **IMAGE_CID**)
> and set each image to `ipfs://<IMAGE_CID>/philippines.webp`; then pin the `metadata/` folder (one **METADATA_CID**)
> and use `ipfs://<METADATA_CID>/2.json` as each candidate's metadata URI.
>
> Tip: open `https://gateway.pinata.cloud/ipfs/<the JSON's CID>` in a browser to confirm it loads.

---

## 2. Register the 5 candidates on-chain

`--max_supply 1000000` = effectively unlimited (the contract rejects `0`; one-per-wallet is what actually
caps each buyer to a single mint). Run one command per contestant, pasting **that NFT's metadata link** from §1:

```bash
PM=CCVLW74KKI7NPWORVMI474RNOROF5LKTRCDCUB6FHZ47CGCL3BCWGMMZ
NET="Test SDF Network ; September 2015"
RPC=https://soroban-testnet.stellar.org

# Isabel = candidate 2. Repeat for 1,3,4,5 with each one's JSON link.
stellar contract invoke --id $PM --source alice --rpc-url $RPC --network-passphrase "$NET" \
  -- add_candidate --candidate_id 2 --max_supply 1000000 --metadata "ipfs://<ISABEL_JSON_CID>"
```

If you used the **folder shortcut** in §1 instead, the metadata links share one CID, so you can loop:

```bash
CID=<METADATA_CID>
for i in 1 2 3 4 5; do
  stellar contract invoke --id $PM --source alice --rpc-url $RPC --network-passphrase "$NET" \
    -- add_candidate --candidate_id $i --max_supply 1000000 --metadata "ipfs://$CID/$i.json"
done
```

**Verify:**

```bash
stellar contract invoke --id $PM --source alice --rpc-url $RPC --network-passphrase "$NET" -- candidate --candidate_id 1
stellar contract invoke --id $PM --source alice --rpc-url $RPC --network-passphrase "$NET" -- remaining --candidate_id 1
```

> Metadata is locked once minting starts — the contract blocks `set_candidate_metadata` after the first
> mint, so double-check the CID before anyone buys.

### (Only if you want a brand-new contract instead of reusing the one above)

```bash
WASM=contracts/target/wasm32v1-none/release/pageant_nft.wasm
stellar contract build --package pageant-nft
NEW=$(stellar contract deploy --wasm $WASM --source alice --rpc-url $RPC --network-passphrase "$NET")
stellar contract invoke --id $NEW --source alice --rpc-url $RPC --network-passphrase "$NET" \
  -- initialize --admin $(stellar keys address alice) --name "CrownFi Delegates" --symbol "CROWN"
# then put $NEW in web/.env as PAGEANT_NFT_CONTRACT_ID and re-run §2 against it
```

---

## 3. Price = 50 USDC (already configured)

The 5 collectibles already sell for **50 USDC** each (sale-splitter listings 1–5). Nothing to do.
To change a price later: edit `priceUsdc` on the collectible and re-register its sale-splitter listing.

---

## 4. One mint per user (already enforced — two layers)

- **On-chain:** `mint(to, candidate_id)` records `Minted(wallet, candidate_id)` and rejects a second mint
  with `AlreadyMinted`.
- **App:** `Purchase` has a unique `(fanId, collectibleId)` constraint, so the UI blocks re-buys too.

Nothing to configure.

---

## 5. Payments — enable GCash (testnet)

Third-party payments are a **testnet toggle** for now, and **GCash** is the only third-party merchant added.

1. Go to **Admin → Payments** (verify your admin wallet if prompted).
2. Keep **Payments enabled** ON and **Environment = Testnet**.
3. Under **Active payment provider**, **GCash (third-party merchant)** now appears — select it to enable
   the GCash rail, or leave **Testnet USDC** as the working mint path. You can disable third-party payments
   any time from this screen.
4. Save.

> GCash is catalogued for testnet/demo. Wiring a **real** GCash merchant checkout (hosted redirect +
> webhook reconciliation) is required before switching Environment to Production.

---

## 6. (Optional) Point the app's mint at `pageant-nft`

Today the buy flow mints via the legacy collectible contract (`COLLECTIBLE_CONTRACT_ID`). To mint from
`pageant-nft` instead, map each collectible to a `candidate_id` and call `pageant-nft.mint(buyer, candidate_id)`
in `web/src/lib/stellar.ts` (`mintCollectible`). This is a code change, not required to sell — say the word
and it can be wired in.

---

### Checklist

- [ ] Pinata: images pinned → `IMAGE_CID`; metadata pinned → `METADATA_CID`
- [ ] `add_candidate` run for candidate_id 1–5 (verify with `candidate` / `remaining`)
- [ ] Price 50 USDC (already set), one-per-user (native)
- [ ] Admin → Payments: GCash available, testnet toggle set
