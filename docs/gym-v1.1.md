> **STATUS (v5.0, 2026-11-21): dated history.** The code it references has
> moved on — `src/components/gym/GymApp.tsx` is now
> `src/components/idman/IdmanApp.tsx`, the static data registries live in
> Supabase (the Rust backend serves them), and the `123/123` demo account
> was removed in schema v3.1. Read for context, not as current behavior.

# Gym v1.1 (2026-11-19) — "daha da yaxşılaşdır"

Follow-up to `gym-v1.md`. The v1 surface (rail + 6 subtabs + shop
directory + home dashboard) stayed; this pass deepens interaction
quality. Everything below was browser-verified at az/en/ru.

## What improved

| Area | Change |
|------|--------|
| Shop tabs — comparison | Every product card now marks its **cheapest store row** with an accent wash + a floating "Ən ucuz / Best price / Лучшая цена" badge (`bestPrice` key). A `Stores: N` line (`atCount`) sits under the brand. |
| Shop tabs — ordering | A segmented control (`sortLabel`) switches **Populyar ↔ Ucuzdan** (popular = curated order, cheap = ascending by the cheapest store price). Ordering is client-side; the stagger entrance re-runs in the new order. |
| Rail — keyboard | The tab list is fully keyboard-walkable: ↑/↓/←/→ wrap, Home/End jump (roving focus on real buttons, so Enter/Space activate natively). |
| Rail — closing | Below lg an open rail now has a **scrim** (`.gym-scrim`): outside-tap and Escape collapse it; choosing a tab still auto-closes. Desktop sidebar shape is untouched — no scrim at lg+. |
| Memory | Last tab (`pl:gym:tab`), active plan (`pl:gym:plan`) and desktop rail state (`pl:gym:rail`) persist to localStorage — **consent-gated** via `hasConsent()`; without consent everything stays in-session. A valid `?tab=` deep link always beats the remembered tab (`linked` prop). |
| Schedule | Today's column gets an accent wash (`data-today`), computed in **Baku wall time** and set **post-mount**, so SSR and hydration can never disagree (no midnight-crossing mismatch). Sunday → no highlight. |
| Home dashboard | The 4 stat tiles became **deep links** (workouts/plan-week/streak → `/gym?tab=plan`, membership → `/subscription`) with a hover lift + ↗ affordance; a `statsHint` line states they are v1 demo figures. |
| i18n | +7 keys ×3 locales (`bestPrice`, `atCount`, `sortLabel/Popular/Cheap`, `statsHint`) — build-messages parity OK at 1208 keys. |

## Files touched

- `src/lib/gym.ts` — `minPriceOf()` (server computes the cheapest once; the client never re-derives it).
- `src/app/[locale]/gym/page.tsx` — shop items gain `minPrice`/`best`/`countLabel`; 4 new root strings; `linked` prop for the deep-link-wins rule.
- `src/components/gym/GymApp.tsx` — keyboard nav, Escape, scrim, consent-gated persistence, sort state, best-badge/count rendering, `todayIdx`.
- `src/app/[locale]/home/page.tsx` — stats → links + hint (`ul.mini-stats > li > a.mini-stat.stat-link`; the diet pages keep their `dd/dt` markup and CSS untouched).
- `src/app/globals.css` — `.gshop-bar/.sort-seg/.buy-best/.gprod-count/.sched [data-today]/.gym-scrim/.stats-hint/.stat-link` + reduced-motion gates; `.gshop-note` margin and `.buy-list a` (position:relative) adjusted.
- `scripts/messages-{az,en,ru}.mjs` → `messages/*.json` (via `bun scripts/build-messages.mjs`).

## Store deep-links: investigated, deliberately NOT shipped in v1.1

The plan was to upgrade the shop rows from store homepages to
per-product search deep-links. Verification from the sandbox:

| Store | Result |
|-------|--------|
| tap.az | 403 Cloudflare bot-challenge — unverifiable |
| kontakt.az | 403 Cloudflare "Just a moment…" — unverifiable |
| unimall.az | every candidate path (`/search?q=`, `/az/search?q=`, `/catalogsearch/result/?q=`) → hard 404 |
| arazmarket.az | SPA: soft-404 app shell for every path — needs JS, unverifiable |
| wolmart.az, aptek.az | connection times out from the sandbox |

Guessing URLs would ship user-facing 404s, so v1.1 keeps the homepage
links. Retry when the stores can be probed from a real browser session
(agent-browser with JS + challenge solving), or curate links manually.

## Still deliberately v1 (unchanged from gym-v1.md)

- Preview user: every visitor = demo account (see auth.ts).
- Prices/store lists are mock; store links → homepages.
- Plan progress and home stats are static numbers.
