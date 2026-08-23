# NFT Metadata + Pinata (IPFS) — deploy your own collection

How to create **per-NFT metadata**, upload artwork + metadata to **Pinata (IPFS)**, and plug the
resulting `ipfs://…` URIs into the `pageant-nft` contract. Each candidate NFT gets its **own
unique metadata file**. No coding — just files + uploads.

---

## 0. What an NFT's metadata is

Each NFT points to a small **JSON file** describing it (name, image, traits). This is the
de-facto standard (same shape OpenSea/marketplaces read):

```json
{
  "name": "Isabel Reyes — Miss Philippines",
  "description": "Official CrownFi collectible for Isabel Reyes, Miss Universe Philippines 2027.",
  "image": "ipfs://<IMAGE_CID>/1.png",
  "attributes": [
    { "trait_type": "Country",   "value": "Philippines" },
    { "trait_type": "Continent", "value": "Asia" },
    { "trait_type": "Height",    "value": "5'8\"" },
    { "trait_type": "Candidate", "value": "1" },
    { "trait_type": "Pageant",   "value": "Miss Universe Philippines 2027" }
  ]
}
```

- **`image`** is the artwork's IPFS URI (not the JSON's).
- **`attributes`** are the traits shown on the NFT — customize freely.
- **One JSON per candidate**, each unique (`1.json`, `2.json`, …).

---

## 1. Prepare your files locally

Make two folders:

```
my-collection/
  images/
    1.png   2.png   3.png   4.png   5.png       # candidate artwork
  metadata/
    1.json  2.json  3.json  4.json  5.json      # one per candidate (see step 3)
```

Name them by **candidate id** (`1`, `2`, …) so they line up with `add_candidate --candidate_id N`.

---

## 2. Upload the IMAGES folder to Pinata → get the image CID

1. Create a free account at **https://pinata.cloud** (free tier ~1 GB).
2. **Add → File** (or **Folder**) → upload the whole **`images/`** folder.
3. Pinata gives you a **CID** for the folder — call it `IMAGE_CID`.
   Each image is now at: `ipfs://IMAGE_CID/1.png`, `ipfs://IMAGE_CID/2.png`, …
   (Preview in a browser via a gateway: `https://gateway.pinata.cloud/ipfs/IMAGE_CID/1.png`.)

---

## 3. Write each metadata JSON (unique per NFT)

In `metadata/1.json`, `2.json`, … put one object per candidate, using the **image CID from step 2**:

```json
// metadata/1.json
{
  "name": "Isabel Reyes — Miss Philippines",
  "description": "Official CrownFi collectible.",
  "image": "ipfs://IMAGE_CID/1.png",
  "attributes": [
    { "trait_type": "Country",   "value": "Philippines" },
    { "trait_type": "Continent", "value": "Asia" },
    { "trait_type": "Height",    "value": "5'8\"" },
    { "trait_type": "Candidate", "value": "1" }
  ]
}
```

Repeat for `2.json` … `5.json` with each candidate's real name/country/image (`ipfs://IMAGE_CID/2.png`, etc.).

---

## 4. Upload the METADATA folder to Pinata → get the metadata CID

1. Back in Pinata → **Add → Folder** → upload the **`metadata/`** folder.
2. You now have a **`META_CID`**. Each candidate's metadata URI is:
   ```
   ipfs://META_CID/1.json
   ipfs://META_CID/2.json
   …
   ```

**These `ipfs://META_CID/N.json` strings are what the contract stores.**

---

## 5. Register each candidate on the contract

Using the deployed `pageant-nft` (`CCVLW74KKI7NPWORVMI474RNOROF5LKTRCDCUB6FHZ47CGCL3BCWGMMZ`),
or a fresh instance for a new pageant (see `contracts/DeploySC.md`):

```bash
RPC="https://soroban-testnet.stellar.org"
PASS="Test SDF Network ; September 2015"

stellar contract invoke --id <PAGEANT_NFT_ID> --source alice --rpc-url "$RPC" --network-passphrase "$PASS" -- \
  add_candidate --candidate_id 1 --max_supply 120 --metadata "ipfs://META_CID/1.json"
stellar contract invoke --id <PAGEANT_NFT_ID> --source alice --rpc-url "$RPC" --network-passphrase "$PASS" -- \
  add_candidate --candidate_id 2 --max_supply 120 --metadata "ipfs://META_CID/2.json"
# … repeat for each candidate
```

Verify: `... -- candidate --candidate_id 1` returns your `max_supply`, `minted`, and the `metadata` URI.

---

## Deploy YOUR OWN new collection later (checklist)

1. New artwork → `images/` folder → **upload to Pinata** → `IMAGE_CID`.
2. Write `metadata/N.json` per NFT (unique name/image/attributes) → **upload to Pinata** → `META_CID`.
3. Deploy a fresh `pageant-nft` instance (or reuse one) — `contracts/DeploySC.md`.
4. `initialize` (name/symbol) → `add_candidate` per NFT with `ipfs://META_CID/N.json`.
5. Store the contract id on the pageant (`nftContractId`) so the app mints against it.

**Tips**
- IPFS is **immutable** — re-uploading a fixed file gives a **new CID**; update the contract metadata
  only *before* minting starts (the contract enforces this).
- Keep a **pinned** copy in Pinata (default) so the files stay available.
- `ipfs://…` is the canonical URI; browsers/apps resolve it via a gateway
  (`https://gateway.pinata.cloud/ipfs/…`).
- Free tier is fine for a few collections; upgrade Pinata for large volumes.
