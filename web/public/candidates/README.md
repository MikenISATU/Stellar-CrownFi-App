# Candidate photos

Two levels — the app tries the **category-specific** photo first, then the **base** photo, then
initials. So you only add per-category images where you want them; everything else falls back.

## Base photos (used everywhere by default)

Put one photo per candidate in **this** folder, named by country slug:

| Candidate      | Country     | Filename            |
| -------------- | ----------- | ------------------- |
| Isabel Reyes   | Philippines | `philippines.webp`  |
| Ayu Lestari    | Indonesia   | `indonesia.webp`    |
| Ratana Somsri  | Thailand    | `thailand.webp`     |
| Mai Tanaka     | Japan       | `japan.webp`        |
| Linh Nguyen    | Vietnam     | `vietnam.webp`      |

(These already exist — just rename your files to match and overwrite.)

## Per-category photos (different image per voting stage)

To show a **different photo of each candidate in each voting category**, drop images into the
matching subfolder here, using the **same country filenames**:

```
candidates/
  swimsuit/    philippines.webp  indonesia.webp  thailand.webp  japan.webp  vietnam.webp
  long_gown/   philippines.webp  …
  qa/          philippines.webp  …
  overall/     philippines.webp  …
```

- **Folder = category key:** `swimsuit`, `long_gown`, `qa`, `overall`.
- **File = country slug** (same as base): `philippines.webp`, `indonesia.webp`, etc.
- If a category subfolder is empty for a candidate, that candidate shows the **base** photo above.
- No code change needed — the Vote page switches photos automatically when you change the stage tab.

## Specs
- **Format:** `.webp`. **Aspect:** portrait ~4:5 (e.g. 800×1000). Under ~250 KB each.
- Any upload is shown with `object-cover`, so it's cropped to fit and stays mobile-responsive.
