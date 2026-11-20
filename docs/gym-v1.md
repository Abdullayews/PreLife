> **STATUS (v5.0, 2026-11-21): dated history.** The code it references has
> moved on — `src/components/gym/GymApp.tsx` is now
> `src/components/idman/IdmanApp.tsx`, the static data registries live in
> Supabase (the Rust backend serves them).
> Read for context, not as current behavior.

# Gym app v1 + Home dashboard (2026-11-18)

**The request:** after registration the sports section needs subtabs —
switch buttons on the LEFT, the content/management on the RIGHT. A ☰ +
current-subtab indicator button opens/collapses the choice list with an
animation. Six subtabs: idman planı, zallar, idman alətləri, qida
əlavələri, aksesuarlar, geyim. The four sale-type tabs are a directory:
browse here, see WHERE to buy (external stores). Home becomes a
dashboard. For v1 every visitor is shown as if a user exists, and the
content is self-filled v1 filler to improve later.

## What was built

| File | What |
|------|------|
| `src/lib/gym.ts` | The gym app data registry: `GYM_TABS` (6 subtabs + icons), `STORES` (6 real AZ retailers — Tap.az, Unimall.az, Wolmart.az, Kontakt Home, Aptek.az, Araz), `SHOP_CATALOG` (4×6 mock products with brand, ₼ price window, per-store price), `GYM_PLACES` (6 halls — 3 reuse the welcome-page copy, 3 new), `PLAN_WEEKS` (mock progress). Pure module, no strings — everything visible is a message key. |
| `src/components/gym/GymApp.tsx` | Client shell + three panels. State: `tab`, `railOpen`, `activePlan`. All strings arrive pre-translated from the server as a `strings` prop (client bundle carries no message catalogues). `?tab=` synced via `history.replaceState` (no refetch); on <64rem the rail auto-closes after a choice. |
| `src/app/[locale]/gym/page.tsx` | Server component: reads `?tab=`, resolves every string (gymApp + reused gymHome namespaces) into view models, renders `<GymApp>`. |
| `src/app/[locale]/home/page.tsx` | Home as a dashboard: Baku-time greeting + name, localized date line, 4-stat row (v1 mock numbers), today's 3 picks (deep-link `/gym?tab=plan`, `/diet`, `/meditation`), gym-store shortcut strip, section cards, subscription banner. |
| `messages/*` via `scripts/messages-*.mjs` | New `gymApp` namespace (~100 keys ×3 locales) + `homePage` dashboard keys. Built with `bun scripts/build-messages.mjs` — parity OK (1202 keys). |
| `src/app/globals.css` | `.gym-*` design-system block: rail/tabs/panels/places/products + utilities `.sr-only`, `.h4`, `.lede-panel`, `.mini-stats.cols4`. |

## The rail (one state, two responsive shapes)

- **<64rem (mobile):** the rail is a sticky bar — [☰ + current subtab + ▾].
  Tapping drops the choice list down (`grid-template-rows: 0fr→1fr`
  tween, chevron rotates 180°); choosing a tab closes it.
- **≥64rem (desktop):** the rail is a sticky sidebar. Closed = 4.75rem
  icon strip (labels fade out via `grid-template-columns: auto 1fr →
  auto 0fr` track tweens); open = 16.5rem with labels. The ☰ head keeps
  the same toggle role; the active tab is highlighted with an accent
  wash + edge bar.
- Panel switches remount with a fade-up (`gym-in`), the plan progress
  bar grows (`gym-bar`), shop cards stagger in (45ms steps). Everything
  respects `prefers-reduced-motion`.

## Shop tabs = "where to buy" directory

Each product card: icon chip, ₼ price window pill, brand, then the
store rows — store name, kind badge (Onlayn / Mağaza / Aptek), typical
price, external link (real AZ retailer homepages in v1; deep product
links later). A note states prices are indicative. Zallar cards carry
rating, feature chips, address, hours, day-pass price and a Google Maps
search link.

## Verified (agent-browser + VLM)

- /az|en|ru /gym + ?tab= deep links: 6 tabs switch, URL syncs, panel
  heads/products/places/schedule all localized; plan switching re-renders
  hero + re-animates the bar (42% → 38%).
- Mobile 390px: dropdown open/close, auto-close on select, no horizontal
  overflow. Desktop 1440px: rail 264px left / panel right.
- Home: greeting by Baku hour, date line, 4 stats, picks, shop strip
  deep-links into /gym?tab=equipment.
- Dark mode pre-paints; footer behaviour identical to existing pages;
  zero console errors; dev.log all 200s.

## Deliberately v1 (mock / to improve later)

- Store links → homepages, not product pages; prices are mock.
- Plan progress (`PLAN_WEEKS`) and home stats are static numbers.
- Zallar addresses/hours are hand-written v1 entries.
