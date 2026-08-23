# CrownFi — UI/UX Design Spec (Figma hand-off)

A complete text map of the current design system, components, and screens. Redesign in Figma from
this, then send changes back. Everything below reflects the live app (Next.js 15 + Tailwind).

**Brand in one line:** light / ivory background, **solid gold** accent, **Times New Roman** serif,
premium & trustworthy (Coinbase/Polymarket calm), with a paired **dark mode**.

---

## 1. Design principles
- **Calm & premium, not flashy.** Gold is an accent, not a flood. Neutral surfaces, hairline borders.
- **Data is first-class.** Odds, pools, prices, timers use **tabular figures**; clear hierarchy.
- **Web2-friendly.** Plain labels, no crypto jargon up front; wallet complexity hidden until needed.
- **One primary action per screen.** Gold CTA = primary; everything else is subordinate (ghost/text).
- **Mobile-first.** ≥44px touch targets, no horizontal scroll, bottom tab bar + burger dropdown.

---

## 2. Color tokens

### Light (default)
| Token | Hex | Use |
|---|---|---|
| Ink | `#23252f` | Primary text, headings |
| Navy | `#1a1f35` | Deep headings / "Official" badge bg |
| Graphite | `#3a3f52` | Body strong |
| Stone | `#5f6172` | Secondary text |
| Muted | `#7a7768` / `#9a968b` | Meta, captions, placeholders |
| **Gold** | `#d4af37` | Primary accent / fills |
| Gold soft | `#e6cf8f` | Focus glow, soft fills |
| Gold deep | `#b8912f` | Gradient bottom, borders |
| Gold ink | `#a97f16` | **Gold text on white** (contrast-safe) |
| Cream | `#faf7ef` | Soft surface (`surface-soft`) |
| Ivory | `#f7f2e7` | Page tint |
| Line | `#ece6d8` / `#e7e2d3` | Hairline borders |
| Emerald / ink / soft | `#10b981` / `#0f6e56` / `#e6f6ef` | Success, "Yes", won, positive |
| Ruby / soft | `#e11d48` / `#fbe9ef` | Errors, "No", danger, live-dot red `#c0392b` |
| Chart series | `#d4af37, #7c3aed, #0ea5e9, #10b981, #f59e0b, #ef4444, #ec4899, #14b8a6` | Odds lines |

**Page background (light):** radial gold glow top-center over a white→cream vertical gradient.

### Dark
| Token | Hex |
|---|---|
| Page bg | gradient `#16171d → #0f1015` + faint gold glow |
| Primary text | `#ece7db` |
| Secondary text | `#aca795` / `#9f998b` |
| Card surface | `#1c1e26` |
| Soft surface | `#191b22` |
| Border | `#31333d` / `#33353f` |
| Gold | stays `#d4af37` / `#a97f16` (brand, brightened for contrast) |

Dark mode is a **class on `<html>` (`.dark`)**, toggled in the header, remembered per user; respects `prefers-color-scheme` on first load.

---

## 3. Typography
- **Family:** Times New Roman (Times, Georgia fallback) for **both display and body** — the signature look. `.font-display` adds `letter-spacing: -0.01em`.
- **Scale (px):** 11 (eyebrow/badge) · 12 (meta) · 14 (body) · 18 (card title) · 24 (h2 small) · 32–48 (section h2) · 60–96 (hero).
- **Weights:** 600–700 headings, 500 labels, 400 body.
- **Eyebrow label:** 11px, UPPERCASE, `tracking: 0.2em`, gold-ink — sits above section titles.
- **Numbers:** `tabular-nums` on all odds %, pools, prices, timers, counts.
- **Mono:** `ui-monospace` for wallet addresses / token ids.
- *(Optional evolution discussed: keep Times for display, add a sans (Inter) for body — not yet applied.)*

---

## 4. Spacing, radius, elevation
- **Spacing:** 4px base scale. Card padding 16/20/24. Section rhythm: `space-y-24` on marketing, `space-y-6/8` in flows. Container `max-w-6xl` centered, gutters `px-4 sm:px-6`.
- **Radius:** cards & sheets **16px** (`rounded-2xl`); buttons & inputs **12px** (`rounded-xl`); chips/badges/pills **full**.
- **Elevation (shadows):**
  - Card: `0 1px 2px rgba(16,24,40,.04), 0 10px 28px -14px rgba(16,24,40,.12)` (crisp, neutral).
  - Card hover: lift `-2px` + `0 20px 44px -18px rgba(184,145,47,.30)`.
  - Gold button: `0 1px 2px rgba(120,90,20,.25), inset 0 1px 0 rgba(255,255,255,.28)`.
  - Modal scrim: `black/40`.

---

## 5. Core components

### Buttons
- **Primary `.btn-gold`** — 2-stop gold gradient `#e4c358→#c39a2c`, white text, inset gold ring, min-height **42px**, pressed = `translate-y +1px` + slight dim. Disabled = 40% opacity.
- **Secondary `.btn-ghost`** — white fill, hairline border `#e4dfce`, gold border on hover, min 42px.
- **Text button** — gold-ink, underline on hover (e.g. "Get test USDC", "Clear filters").
- **Icon button** — 36–40px square, ghost style, Lucide icon (18px).

### Inputs `.field`
- Min-height **44px**, radius 12px, border `#e0dac9`, white bg. Focus: gold border + soft 4px gold ring (`gold/15`). Placeholder muted. Search field adds a left magnifier + right clear (✕).

### Chips / badges / tags
- **`.chip`** — pill, cream bg, hairline border, 12px medium.
- **Status badges** — Live (red bg + **pulsing dot**), Resolved (emerald), Upcoming (blue), Closing (amber), Cancelled (ruby).
- **`.tag-on` / `.tag-off`** — emerald "on-chain" / neutral "off-chain".
- **Official** = navy pill + gold text "★ Official"; **Community** = white/85 pill.

### Cards `.glass`
- White, radius 16px, hairline border, crisp neutral shadow, `.glass-hover` adds lift. Used for every card/panel/modal.

### Navigation
- **Header** — floating rounded-2xl pill, sticky `top-3`, backdrop-blur, hairline + crisp shadow. Left: burger (mobile) + logo + "CrownFi". Center (desktop): nav links, active = gold gradient pill. Right: **theme toggle** + **wallet chip/Connect**.
- **Mobile** — burger opens a dropdown under the header; plus a **fixed bottom tab bar** (5: Vote, Verify, Tickets, Collect, Me) with icon + label.
- **Nav links:** Home, Vote, Predict, Leaderboard, Verify, Tickets, Collect, Rewards, Organizer, Me (+ Admin if admin).

### Modal / sheet
- Centered card (`max-w-sm/xl`), `black/40` scrim (click to dismiss), Cancel + primary action. GCash modal shows the GCash logo.

### Toast
- Bottom-center pill, auto-dismiss ~3s, emerald (ok) / ruby (error), `floatUp` entrance.

### Data components
- **MarketCard** — banner (category image or gold gradient, 96–112px) with Official/Community + status badges + category chip; 2-line question; **top-2 outcomes** (label · % · gold bar) + "+N more"; footer "{pool} USDC · {n} in · Ends in Xd". Resolved → "🏆 {winner} won".
- **OddsChart** — inline SVG multi-line, 0–100% gridlines, **time axis** (start→end), legend with live % per option. Empty state until ≥2 data points.
- **Outcomes table** (market detail) — columns **Outcome · Chance · Pool · To-win (×mult)**, thin proportion bar under each name, click-to-select, tabular figures.
- **Portrait** — 4:5, gradient + initials fallback, flag chip top-left, gradient scrim bottom; supports category-specific photo → base photo → initials fallback chain.
- **NftCard / SpotlightCarousel / SeatMap / Flag** — collectible card, 3-up spotlight carousel, arena seat grid, SVG country flags.

---

## 6. Interaction & motion
- Durations **150–250ms**, ease-out enter. Press: buttons `translate-y +1px`, cards `active:scale-[0.99]`.
- Live markets: **pulsing red dot** (motion-safe). Loading: **card-shaped skeletons** (reserve space, no layout shift).
- Respects `prefers-reduced-motion`. Global focus-visible = 2px gold outline.
- Mobile: `touch-action: manipulation` (no 300ms delay), no tap-highlight.

---

## 7. Responsive
- Breakpoints: **375 / 640(sm) / 768(md) / 1024(lg) / 1280(xl)**.
- Grids: cards `1 → sm:2 → lg:3`. Detail pages `lg:grid-cols-[1.4fr_1fr]`.
- Mobile: bottom tab bar + burger dropdown; category filters scroll horizontally; sticky market filter bar; `100dvh` (no URL-bar jump).

---

## 8. Screen map (18 routes)

| Route | Purpose | Key sections (top → bottom) |
|---|---|---|
| `/` Home | Landing | Hero (logo coin, "CrownFi App", tagline, Buy Tickets / Vote) → **Live prediction markets** (spotlight + 3 cards) → Meet the Delegates (carousel) → Own a piece (NFT feature) → Reserve seat (stage banner) → Stats (4 count-ups) → How it works (3 steps) → FAQ |
| `/predictions` | Market list | Sticky header (title + Create/Connect) → **Create market** form (collapsible) → sticky search + category scroll + status filters + count → Live-now featured → All markets grid |
| `/predictions/[id]` | Market detail | Banner header (category/status/question/pool) → resolved winner banner → left: **outcomes table** + predict panel (amount + quick chips + est payout) → right: **odds chart** + stat tiles + your positions (+cancel) + how-it-settles + activity |
| `/vote` | Voting | Header (round · status) → **stage tabs** (Swimsuit/Long Gown/Q&A/Overall, red dot = open) → contestant spotlight carousel → Cast vote CTA → Live tally |
| `/contestants` | Collect list | Header + USDC balance/faucet → spotlight carousel → grid of collectible cards (portrait, "1 per wallet", price, Collect) |
| `/contestants/[id]` | Collectible/candidate | Left: "Support Your Queen" + Network/Price/Supply(1 per wallet) + wallet + mint CTA (or Pay with GCash) → Right: floating NFT card + rank/votes/share stats + Vote link |
| `/leaderboard` | Rankings | Title → live vote bars per contestant |
| `/loyalty` | Rewards | Points balance → tasks → rewards to redeem |
| `/me` | Dashboard | Name (editable) → stats (points, active predictions, wallet) → panels (Predictions/Votes/Tickets) → **Collectibles NFT gallery** (art + Token #, explorer link) |
| `/tickets` | Tickets | Tiers + seat selection + buy |
| `/tickets/[id]` | Voucher | Ticket voucher / QR |
| `/tickets/verify/[id]` | Check-in | Scan/verify a ticket |
| `/verify` | Vote receipt | Enter/verify a vote against the Merkle root |
| `/seatmap` | Arena | Seat grid preview |
| `/organize` | Apply to host | Apply form ("We review every request") |
| `/organizer` | Organizer dash | Organizer-facing data |
| `/admin` | Admin | Tabs: Overview / Rounds / Contestants / Requests / Pageants / Payments / **Markets** (create + resolve). Payments: enable/KYC/maintenance toggles, provider, GCash |
| `/faq` | FAQ | Accordion |

**Global chrome (every page):** floating header, maintenance banner (when on), main container, gold footer (brand + newsletter + link columns + "We accept GCash" + bottom bar), mobile bottom tab bar.

---

## 9. Footer
Gold gradient band. Columns: brand + newsletter (email + Join) + socials; Explore / Experience / Organizers link lists; **"We accept [GCash logo]"**; bottom bar "© 2026 CrownFi · Testnet demo" + "Crown your queen, on-chain."

---

## 10. Iconography & assets
- **Icons:** Lucide, stroke ~1.75–2px, sizes 14/16/18/20. No emoji as structural icons (a few decorative 🏆/🔥 in copy only).
- **Logo:** `/brand/logo.png` (crown coin). **GCash:** `/brand/gcash.svg`.
- **Images:** candidate photos `/candidates/<country>.webp` (+ `/candidates/<stage>/…` per stage); NFT art `/nfts/…`; category banners `/categories/<key>.webp`; real SVG flags `/flags/…`.

---

## 11. When redesigning in Figma — keep / change
**Keep:** gold accent, hairline-border cards, one-primary-CTA rule, tabular data, dark-mode parity, 44px touch targets.
**Fair game to change:** the all-serif type (a serif-display + sans-body split would read more "modern crypto"), hero composition, card density, the gold gradient button (could go flatter), section spacing, illustration style.

Send the redesigned tokens/components back as: **color hexes, type scale, radii, shadows, and per-component specs** — I'll map them straight onto the Tailwind config + `globals.css` tokens and the components above.
