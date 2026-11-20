# Task 2-b — Account LOCATION system (Settings → Location + content filtering)

Agent: Subagent B (Task ID 2-b) · Status: COMPLETE · `bun run lint` exit 0 · tsc 0 errors

## Files changed (all within the ownership list)

| File | Change |
|---|---|
| `src/lib/server/account.ts` | `prefsView` gains `contentLocation` ("az" else "global"); GET selects `content_location`; PATCH validates `body.contentLocation ∈ {global, az}` (else `badRequest`) → `patch.content_location`, and on change mirrors it to `sessions.user_location` via `supaUpdate(...).catch(() => {})` — exactly the rail_folded pattern. |
| `src/lib/api.ts` | New exported `filterByLocation<T extends { country?: string | null }>(rows, location?)` (pure, per-call, undefined-safe: `country ?? "AZ"`) + `export type ContentLocation = "global" \| "az"`. `getGymAppContent(locale, location?)` filters `halls` and `stores` (and passes `country: p.country` / `s.country` through into the typed objects so the tag flows the moment content.ts emits it). `getDietContent/getLibraryContent(location?)` filter `places`; `getMeditationContent(location?)` filters `psychologists`. All filtering happens AFTER the 60s TTL-cached catalog fetch, never inside the cache. |
| `src/lib/gym.ts` | Type additions only: `country?: string \| null` on `GymAppPlace`, `GymAppStore`, `GymPlace` (raw), `StoreRef` (raw). |
| `src/lib/nutrition.ts` | Type addition: `export type DietPlace = Place & { country?: string \| null }`; `DietContent.places: DietPlace[]`. |
| `src/lib/library.ts` | Type addition: `export type LibraryPlace = Place & { country?: string \| null }`; `LibraryContent.places: LibraryPlace[]`. |
| `src/lib/psychology.ts` | Type addition: `country?: string \| null` on `Psychologist`. |
| `src/components/SettingsPage.tsx` | New `LocationPanel` (between Language and Notifications in DOM + set-nav): two selectable cards (`card subtier` + `data-active`, `role="radiogroup"`/`role="radio"` + `aria-checked`, Globe/MapPin icons, title+desc from `settingsPage.location.*`), mount-fetches `GET /api/me/preferences` for the initial value, PATCHes `{contentLocation}` immediately on select with a `LoaderCircle spin` loading state on the saving card (both disabled while busy), on success `toast(tl("saved"))` + `router.refresh()`, on failure the existing error pattern (`field-error` role=alert with the generic `settingsPage.devices.error` string — same reuse as SubscriptionBuilder). CATS gains `{ id: "location", icon: MapPin }`; nav label uses `tl("title")` (see deviation 2). |
| `src/app/[locale]/gym/page.tsx` | Passes `"location" in user ? user.location : undefined` to `getGymAppContent` (demo fallback object has no location). Also added `role: "user" as const, psychSlug: null` to the demo fallback to fix two PRE-EXISTING tsc errors from the lead's uncommitted `user.role ?? "user"` / `user.psychSlug ?? null` lines (union access on the demo object). No behavior change. |
| `src/app/[locale]/diet/page.tsx` | `getDietContent(user.location)` (user already captured). |
| `src/app/[locale]/diet/plans/page.tsx` | Captures `const user = await requireUser(...)`, passes `user.location`. |
| `src/app/[locale]/diet/recipes/page.tsx` | Same as plans. |
| `src/app/[locale]/diet/places/page.tsx` | Same as plans — the venues page the filter visibly drives. |
| `src/app/[locale]/meditation/psychologists/page.tsx` | Captures user; `getMeditationContent(user.location)` inside the Promise.all. |
| `src/app/[locale]/library/page.tsx` | `getLibraryContent(user.location)` (user already captured). |

No new routes; PATCH `/api/me/preferences` route already forwards the whole body to `preferencesUpdate`.

## Verification (curl only; account psych.test@prelife.net)

1. Login: `{"user":{...,"role":"psychologist","psychSlug":"aida-k","location":"global"}}`
2. `GET /api/me/preferences` → `{"locale":"az","theme":"light","railFolded":false,"contentLocation":"global"}`
3. `PATCH {"contentLocation":"az"}` → `..."contentLocation":"az"}`; GET again → `"az"`; invalid value: `PATCH {"contentLocation":"tr"}` → **400** `{"error":"invalid"}`; PATCH back → `"global"`.
   - Session mirror proven: fresh login while az → session user `location = "az"`; after PATCH back → fresh login `location = "global"`.
4. Page renders, both modes (all with cookies):
   - az mode: `/az/gym` 200 (grep "Vertex Strength Hall" → 1 hit), `/az/diet/places` 200 (renders `Yaşıl Bazar`, `Fit Mətbəx`, `Nourish Bar`), `/az/library` 200, `/az/meditation/psychologists` 200 (`aida-k` present). Same 6 halls + 6 stores serialized in global and az mode (`ironhouse…summit`, `tap…araz`) — correct because every current row is AZ.
   - global mode: all four → 200; product offers intact (`Wolmart/Araz/Unimall` present, 96 `storeName` occurrences).
5. Filter proof — the REAL exported helper (temp scratch file inside the project for `@/` alias resolution, deleted after):
   `az → [{"country":"AZ","n":"a"},{"n":"c"}]` · `global/null/undefined → [{"country":"AZ"},{"country":"TR"},{}]` (untagged rows kept in az mode).
   Inline replica output identical: `[{"country":"AZ"},{}]` vs `[{"country":"AZ"},{"country":"TR"},{}]`.
6. `bun run lint` → **exit 0** (31 warnings / 0 errors; warnings are the pre-existing `prefer-tag-over-role` class — my 2 new ones are the same class for `role="radiogroup"`/`role="radio"`). `tsc --noEmit` → 0 errors. (Mid-session there were 2 oxlint errors in `psych/ScheduleBook.tsx` — another agent's in-flight file; that agent fixed them concurrently, final state clean.)
7. Settings renders: nav cats az `['Hesab','Cihazlar','Görünüş','Dil','Lokasiya','Bildirişlər']`, en `['Account','Devices','Appearance','Language','Location','Notifications']`, ru `['Аккаунт','Устройства','Внешний вид','Язык','Локация','Уведомления']`; client payload embeds `Lokasiya/Qlobal/Yalnız Azərbaycan/yadda saxlanıldı`.

## content.ts country pass-through — CONFIRMED DROPPED (do not rely on it yet)

All four builders construct the typed objects explicitly and drop `country` (READ-ONLY audit, file untouched):
- `gym_places` → `src/lib/server/content.ts` `gymCatalog` `placesJson` map (lines ~239–271) — no `country` key.
- `gym_stores` → `storesMap` (lines ~286–292) — no `country`.
- `world_places` (diet + library `places`, meditation `mentors`) → `worldRows` `placesJson` (lines ~119–130) — no `country`.
- `psychologists_v2` → `meditationCatalog` `psyJson` (lines ~508–535) — no `country`.

Handling per instructions: the TYPES carry `country?`, `api.ts` passes `p.country`/`s.country` through where it builds objects (gym halls/stores), and `filterByLocation` is undefined-safe (`country ?? "AZ"` → kept in az mode). Verified live: the SSR payload serializes `"country":"$undefined"` today and az mode shows identical content to global. The filter becomes effective the moment content.ts copies the tag through (one-line additions in those four builders — lead's file).

## Deviations & findings for the lead

1. **Ran `node --env-file=.env scripts/sync-i18n.mjs`** (DB data operation; no file edits; the script is not on the forbidden list). Reason: the runtime message source is the DB catalog (`request.ts` deep-merges static fallback UNDER the DB tree), and the new keys exist in `messages/*.json` only as a FLAT top-level key `"settingsPage.location"` — which next-intl 4 **cannot resolve** (`resolvePath` walks nested segments `messages.settingsPage.location`) and flags as **INVALID_KEY** (dev log had 414 occurrences before my work). Pre-sync the settings nav literally rendered `settingsPage.location.title`. Post-sync (1838 keys, exact mirror, key-parity verified across az/en/ru first) the nav renders `Lokasiya/Location/Локация` and the panel strings ship to the client (verified via curl).
2. **`settingsPage.cats.location` does not exist in any locale** (static or DB). The set-nav entry therefore labels itself with the section title `tl("title")` via `{id === "location" ? tl("title") : t(`cats.${id}`)}`. If you add `cats.location` later, the ternary can simply be dropped.
3. **INVALID_KEY dev-log noise persists** (2 errors per request: `settingsPage.location`, `psychApp.console`) — it comes from the flat keys sitting in the static `messages/*.json` fallback, which I may not edit. Zero-risk fix on your side: nest those keys inside their parents in `scripts/messages-*.mjs` — `flatten()` produces the identical dotted DB rows either way, so the sync output is unchanged; only the static fallback becomes valid for next-intl.
4. **Store offers**: I filter `stores` BEFORE the offers join in `getGymAppContent`, so in az mode product offers never point at an out-of-scope store (products keep rendering with their remaining AZ offers; all-AZ today, so no visible change).
5. **Meditation `mentors`** (world.places on /meditation welcome) are NOT filtered — the mission scoped meditation filtering to `psychologists`, and /meditation/page.tsx is not in my call-site list.
6. gym/page.tsx demo-fallback fix (role/psychSlug) described in the table above — pre-existing tsc errors in my owned file, trivially fixed without behavior change.

Test account left in its original state: `contentLocation: "global"`, locale az, theme light.
