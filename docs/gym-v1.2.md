# Gym v1.2 (2026-11-18) — "daha da yaxşılaşdır" (ikinci tur)

Follow-up to `gym-v1.1.md`. The v1.1 surface is unchanged; this pass makes
the three panel types *interactive* instead of just viewable. Everything
below was browser-verified at az/en/ru, mobile (390px) and desktop.

## What improved

| Area | Change |
|------|--------|
| Shop tabs — live search | A search field (`.gshop-search`) sits next to the sort segment and filters live by **product name, brand or store name** (case-insensitive `includes`). Typing does NOT remount the grid (focus stays in the field, matches just drop out); a ✕ button inside the field clears it, an `aria-label`-led clear button sits in the empty state. |
| Shop tabs — a11y count | An `<output class="sr-only">` live region announces `{shown} / {total}` after every keystroke/sort. `resultsA11y` is passed as a **raw template** (`t.raw`) — the count is only known client-side, so `t()` would throw `FORMATTING_ERROR` demanding the ICU values. |
| Zallar — sort | A second sort segment: **Reytinq ↔ Qiymət** (rating desc / day-pass asc, stable ties). Default rating. |
| Zallar — amenity chips | Toggle chips derived from the *already-translated* feature labels (no extra data plumbed) — **"Hamısı"** + 9 amenities, OR semantics, empty set = no filter. Unreachable-with-current-data empty state is still wired defensively. |
| Plan — daily check-in | A **"Bu günü tamamla"** button under the progress bar marks today's workout done → accent pill "Bu gün tamamlandı" + "Geri al". Per plan, dated `YYYY-MM-DD` in **Baku time** (`pl:gym:done:<planId>`), consent-gated; verified to survive a reload and to stay independent per plan. |
| Animation | Sort/filter changes re-key the grid so the entrance stagger replays in the new order — `.gplace` now animates like `.gprod` (`gym-in` + `--i` delay). The done pill pops in (`gym-pop` keyframes). All of it is disabled under `prefers-reduced-motion`. |
| Reset semantics | Search and gyms controls are **panel-local**: switching tabs resets the query (explicitly in `selectTab`), and GymsPanel unmounts on tab switch so its sort/chips reset themselves. Nothing new is persisted except the check-in date. |

## Files touched

- `src/components/gym/GymApp.tsx` — `query` state (+ reset in `selectTab`), ShopPanel search/filter/empty, GymsPanel sort+chips (panel-local state), PlanPanel check-in (`readStored`/`store`/`removeStored`, `bakuTodayStr`, `fillCount`), `<output>` live regions.
- `src/app/[locale]/gym/page.tsx` — 13 new strings wired; `resultsA11y` via `t.raw`.
- `src/app/globals.css` — v1.2 section: `.gshop-search` (focus ring, native cancel hidden), `.gsearch-clear`, `.gempty`, `.gyms-bar`, `.gyms-chips`, `.chip-f` (pressed = accent), `.gplace` stagger, `.gplan-done`, `.gdone-btn`, `.gdone-pill`, `gym-pop`, reduced-motion gates.
- `scripts/messages-{az,en,ru}.mjs` → `messages/*.json` — parity OK at **1221 keys** (5 root search keys + 3 plan check-in + 5 gyms control keys).

## Verification notes (agent-browser)

- Check-in: mark → pill; undo → button back; reload (consent accepted) → still done; switch plan → other plan unchecked.
- Gyms: default = rating order; Qiymət → 14→22 ₼; "Hovuz" chip → Iron House + Summit only; "Hamısı" restores 6.
- Shop: `halter` → 1, `Torros` → 1 (brand), `Kontakt` → 3 (store match), `Reebok` in equipment → 0 (correct — Reebok lives in accessories/clothing), `zzzz` → empty state; tab switch resets the field.
- Cheap sort: 19 → 245 ₼ ascending; keyboard rail, scrim and mobile rail behavior re-confirmed unchanged.
- No page errors, no console errors; az/en/ru all render the new strings translated.

## Still deliberately v1 (unchanged)

- Prices/store lists are mock; store links → homepages (deep-links blocked by store bot-walls, see v1.1 notes).
- Plan progress and home stats are static numbers; the check-in is the first piece of real (local) tracking.
