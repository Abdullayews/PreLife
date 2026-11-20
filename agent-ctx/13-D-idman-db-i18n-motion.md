# 13-D — İdman (gym) surface: DB-wired + full i18n + motion polish

## What changed (files + line deltas)

| File | Change |
| --- | --- |
| `src/lib/server/content.ts` | +15 — `gymCatalog()` now also fetches `gym_equipment` + `gym_trainer_specs` and emits `equipmentRegistry` / `trainerSpecs` (code → nameKey maps) alongside the existing output. |
| `src/lib/gym.ts` | ~155 rewritten — `GymContent` extended with the two registries; NEW `GymAppContent` family of resolved, serializable types (`GymAppPlace/Store/Product/Offer/Exercise/Plan/PlanDay`); pure helpers `msgPath()` (dot-path resolve in a message tree), `fillMsg()`, `repsLabelKey()` kept; `minPriceOf(offers)` now takes the offer list. Kept `GYM_TABS`/`SHOP_TAB_IDS`/`isShopTab` exactly (home page imports them). |
| `src/lib/api.ts` | +151 — NEW `getGymAppContent(locale)`: fetches `gymCatalog()` (TTL-cached, raw keys), then resolves EVERY key into final locale strings via `getMessages({locale})` (merged DB+static catalog): places (own `ns` → gymHome/gymApp tree), features (gymHome.feat*), equipment/trainer-spec labels, store kind labels, product names (`gymApp.<cat>.<slug>`), offers joined to stores, plan catalog (names/desc/level/meta via gymHome, week progress, day-by-day exercises with reps rendered through `gymApp.rep*` templates). Returns null when the content backend is down. |
| `src/app/[locale]/gym/page.tsx` | fetches `getGymAppContent(locale)`; `if (!catalog || halls empty) return <ContentUnavailable locale/>` (same degrade as diet/meditation/library). Passes `catalog` through `IdmanPage`. Auth/rail/tab deep-link wiring unchanged. |
| `src/components/idman/IdmanPage.tsx` | accepts + forwards `catalog: GymAppContent`. AppShell props contract unchanged. |
| `src/components/idman/data.ts` | 687 → ~200 lines. Now ONLY: tab id registry (`IDMAN_TABS` ids, `isIdmanTabId`), the Mixkit video registry (+ `exerciseVideo`/`productVideo` lookups), plan payload types + pure helpers (`muscleGroupsOf(day, registry)`, `totalSetsOf`, `minutesOf`), quiz STRUCTURE (`QUIZ_STEPS`: ids/kind/option count/cap — text comes from `gymApp.quiz.*`), shop filter-group codes (`SHOP_GROUPS`, `GROUP_ORDER`, `groupOf`). ALL business data arrays deleted (HALLS, STORES, PRODUCTS, EXERCISES, EQ_LABELS, DAY_NAMES/DAY_SHORT, UI table, TAB_HEADS, FILTER_GROUPS labels, STORE_KIND_LABEL, QUIZ text, DEMO_PLAN). |
| `src/components/idman/IdmanApp.tsx` | fully rewritten (~1250 lines). Renders from `catalog` props + `useTranslations("gymApp")`. Weekday names via `Intl.DateTimeFormat(locale, {weekday})` (2024-01-01 = Monday anchor). Plan panel: GET `/api/gym/plan?locale=<catalog.locale>` (was hardcoded `az`), honest unavailable+retry state replaces DEMO_PLAN; quiz → POST flow unchanged; weekly strip; NEW read-only plan-catalog section ("All plans" — `gymApp.plan.plansEyebrow`) with meta chips, week-progress bars and expandable day details. Product cards: rating display dropped (gym_products has no rating column); offers show resolved store name/kind/price with best-price highlight. Hall cards: resolved amenities/equipment/trainer specs. Direction-aware tab panel transitions (render-phase state adjust so the entering panel has the right class on frame 1). |
| `src/lib/server/user-plans.ts` | `EXERCISES` import from idman/data REMOVED. NEW `loadExerciseRegistry(locale)` — reads `gym_exercises` via `gymCatalog()` (TTL cache) and resolves name/target to the locale at call time via `getMessages`; static fallback = 15 codes with the code as a safe generic name (DB-unreachable only). `defaultPlan`/`normalizePlanInput`/`ruleBasedPlan`/`registryBlock` now take the registry; public function signatures unchanged (ai.ts, routes, home page untouched). RU answer matching in the rules fallback extended (продв/средн/масс/мышц stems). |
| `scripts/messages-{en,az,ru}.mjs` | synced from JSON first (`json-to-mjs.mjs` — the mirrors were 793 keys STALE vs messages/*.json; a naive build would have wiped them), then +78 NEW gymApp keys ×3 locales; `node scripts/build-messages.mjs` → parity OK, 1796 keys. |
| `messages/{en,az,ru}.json` | regenerated (canonical ASCII-escaped output; semantically identical for pre-existing keys — verified, plus the new keys). |
| `src/app/[locale]/layout.tsx` | `"gymApp"` added to the client namespace whitelist (one line). |
| `src/app/globals.css` | +182 lines, APPEND-ONLY section `/* ── v4 idman: DB-wired + motion (append-only) ── */` at EOF. No existing line touched. |
| `src/app/api/content/gym/route.ts` | NOT changed — the route serializes `gymCatalog()` as-is; the two new registries flow through automatically (verified by curl). |

## Data provenance after this pass

- **DB-backed (server-resolved)**: 6 halls (+addresses/hours/day-price/rating/images), amenities, equipment floors, trainers + specialities, 6 stores, 40 products (+offers joined), 15-exercise registry (names/targets/guides), 3-plan catalog with day/exercise details + week progress, store kind labels, plan level labels, plan meta tags, reps prescriptions (via rep* templates).
- **i18n-backed (gymApp namespace, 3 locales)**: all UI strings — tab heads, shop search/sort/filter labels + group labels, quiz copy (6 questions, 20 options), plan panel copy, halls panel copy, sidebar/nav strings, weekday names (Intl).
- **Still static (presentation assets by design)**: Mixkit video URLs (exercise codes + product slugs), quiz structure codes, filter-group code mapping.

## gymApp keys added: 78 per locale
`plan.*` +20 (loading, buildCta, resetCta, aiTag, defaultTag, offlineNote, planUnavailable, retry, nextSession, sessionSummary, muscleGroups, workoutTag, restTag, statExercises/Sets/Minutes, daysPerWeek, daysToggle), top-level +3 (ratingA11y, filterLabel, filterAll), `nav.*` +14, `quiz.*` +35, `group.*` +6. All ICU params identical across locales (build-messages parity gate).

## Motion implemented (append-only CSS + component wiring)
- a) Direction-aware in-page tab switch: `.ipanel-fwd/.ipanel-back` — fade + translateX(±10px), 220ms ease-out; direction computed during render (no 1-frame wrong class).
- b) Quiz: direction-aware step slide (±12px, 250ms ease-out) + linear-width progress bar at the top (250ms linear — correct for progress).
- c) Exercise check-off: inline SVG check — pop (250ms) + stroke-dash draw (400ms ease-out, 100ms delay), plus one-shot soft background wash on the card.
- d) Weekly strip current-day cell: one-time soft highlight (`idman-today`, 600ms, once — no infinite).
- e) Product/hall/plan cards: hover lift translateY(-2px) + one shadow step, ONLY under `@media (hover:hover) and (pointer:fine)`; entrance `animation-fill-mode` switched to `backwards` (in my section) so the lift isn't pinned by the entrance animation.
- f) Press scale(.97) 160ms ease-out on every pressable (ibtn, chips, seg, search-x, offer rows, nav rows/fold/fab, itag-more) with full transition overrides that preserve the existing color phases.
- g) `prefers-reduced-motion`: everything above degrades to none/instant (check path draws instantly via `stroke-dashoffset: 0`).
- No stagger on high-frequency lists (entrance delays zeroed for .iex/.iprod/.izal-card). Motion tokens referenced with local fallbacks: `var(--ease-out, cubic-bezier(0.23,1,0.32,1))` — safe before/after the lead's :root token pass.

## Verification
- `bun run lint` → **exit 0, 0 errors** (27 pre-existing-style warnings: `prefer-tag-over-role` on role="progressbar"/"img"/"group" — same attributes the original code used; also present in Nav/CookieConsent/ProfileEditor).
- `curl /api/content/gym` → full JSON: 6 places, 6 stores, 40 products across 4 cats, 15 exercises, 3 plans, workouts (3/4/5 days), planWeeks, equipmentRegistry (22), trainerSpecs (12).
- Rendered `/az|en|ru /gym?tab=…` with a session (demo account): halls names/descs/amenities/equipment/trainer-specs/day-pass/maps CTAs all locale-final; supplements tab RU ("Сывороточный протеин", chips "Протеин/Креатин и аминокислоты/Витамины и минералы", best-price tag); accessories chips (Aksesuarlar/Geyim), equipment tab 10 Mixkit videos + group chips (Çəkilər/Qurğular/Yumşaq avadanlıq); plan tab SSR shell + client fetch OK; plan catalog + resolved exercises ship in the RSC payload ("3 days/week", "8–12 reps", "5 min", "10 each side").
- `/api/gym/plan` GET/POST/DELETE with locale=en: starter plan recreated with EN registry names; quiz POST → rules fallback plan with EN names + detected level. Demo account restored to its original AZ starter plan + onboarding=false afterwards.
- dev.log clean: only a transient mid-edit compile error (data.ts rewritten before user-plans.ts — resolved); final compiles all 200/307 with no errors.

## Notes / risks for the lead
1. **messages/*.json got re-canonicalized** (pure-ASCII \uXXXX escapes) — semantically identical to HEAD for all pre-existing keys (verified programmatically), but the diff is large. The .mjs mirrors were 793 keys stale; I synced them via `json-to-mjs.mjs` FIRST (the documented safe direction) — never run `build-messages.mjs` without that sync.
2. The emulator's `i18n_messages` table (built at boot) lacks the 78 new keys until the next server restart — harmless: request.ts falls back to static messages for missing DB keys (verified live). After any restart the DB picks them up.
3. Product rating stars are gone from product cards (gym_products has no rating column). Hall ratings stay (gym_places.rating).
4. The quiz still POSTs localized option text (server contract unchanged); the rules-fallback answer matching now also understands RU stems, but the AI path is the primary one.
5. The plan tab's unavailable state (API down) now shows "plan unavailable + retry" instead of the old hardcoded AZ DEMO_PLAN twin — intentional (no hardcoded business data left client-side).
6. `role="progressbar"` etc. warnings are pre-existing style (same as the old code); happy to switch to native elements if the lead prefers, but that touches a11y markup the rest of the app shares.
