# Category banner images

Drop a banner image here for each prediction-market category. When a market has **no uploaded
banner**, the app automatically uses the image for that market's category (and falls back to the
gold gradient if the file is missing).

## How to add them

1. Save each image in this folder (`web/public/categories/`).
2. Name it **exactly** by the category key, as `.webp` (recommended) — for example:

| Category (in the create form) | Filename to add here    |
| ----------------------------- | ----------------------- |
| Preliminary                   | `preliminary.webp`      |
| National Costume Round        | `national_costume.webp` |
| Swimsuit Round                | `swimsuit.webp`         |
| Long Gown Round               | `long_gown.webp`        |
| Question & Answer Round       | `qa.webp`               |
| Overall Winner                | `overall.webp`          |
| Other                         | `other.webp`            |

3. That's it — no code change needed. The banner shows up on the market cards, the detail page,
   and the homepage spotlight for every market in that category.

## Recommended specs

- **Format:** `.webp` (smallest). `.png` / `.jpg` also work — but then rename the reference in
  `categoryImage()` in `web/src/lib/segments.ts`, or just convert to `.webp`.
- **Size:** ~1200×400 (wide banner). Keep each file under ~250 KB for fast loads.
- Anything you upload as a per-market banner in the create form overrides the category default.
