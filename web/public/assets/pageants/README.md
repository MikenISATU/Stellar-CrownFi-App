# Pageant assets

Uploaded pageant/candidate images live here (dev). One folder per pageant, one per candidate,
one per image kind — mirrors `web/src/lib/assets.ts`.

```
/assets/pageants/
  <pageant-slug>/
    candidates/
      <candidate-slug>/
        profile/         # candidate profile photo
        swimsuit/        # swimsuit competition photo
        long-gown/       # long gown competition photo
        nft-artwork/     # dedicated collectible artwork (NOT a competition photo)
```

Add new competition categories by adding a new `Category` row + a matching folder segment
(`folderForKind`) — no code change needed.

**Storage:** in development these are served statically from `web/public`. For production,
swap the storage adapter to Supabase Storage or Pinata/IPFS (NFT artwork must go to IPFS on
approval) — path builders stay the same.
