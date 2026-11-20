# 2-c — Psychologist request workflow: reserve → message → console confirm → payment-due e-mail

Task ID: **2-c** (Subagent C). All work items completed; `bun run lint` → **0 errors, 31 warnings** (warning class unchanged from the codebase's pre-existing `prefer-tag-over-role`/`no-noninteractive-tabindex` style). Dev server never restarted; verified end-to-end over curl against :3000 + the live Supabase.

## Files changed / added

| File | Change |
| --- | --- |
| `src/lib/server/supa.ts` | +1 function `authAdminGetUser(id)` (exact snippet from the brief — GoTrue admin GET one user). Nothing else touched. |
| `src/lib/server/psych-data.ts` | `book()` reworked: `message` required (trim, grapheme-safe 1..1000), `custom: true` skips availability blocks but enforces hour 6..23 + Baku-date window [today, today+60d] (`slot_past` 409 for past, `invalid` 400 beyond 60d); inserts `status:'requested'`, returns `{ id, status: "requested" }`. `pay()` now requires `status==='confirmed'` (else 409 `not_confirmed`) and sets `payment:'paid'` + `status:'upcoming'`. `appointmentView` adds `message` + `respondedAt`. NEW `consoleList` (role/psychSlug guard → pending 20 / confirmed 10 / upcoming 10 queues, per-row client `{name,email}` via `authAdminGetUser` + `profiles.full_name`, deduped per user, plus `custom` flag computed against `psychologist_availability` blocks). NEW `consoleRespond(user, body, origin)` (row must be own+requested; confirm → `confirmed`+`responded_at`+payment-due mail; decline → `cancelled`+`responded_at`+declined mail; client locale from `profiles.lang` default az; mail failures never fail the response). `overview()` upcoming filter → `status=in.(requested,confirmed,upcoming)`. Helpers: `plusDays`, `bakuLabel` (Intl formatToParts Baku wall-clock label), `psyDisplayName`, `clientOf`, `requirePsychConsole`. |
| `src/lib/server/mail.ts` | +`PAYMENT_STRINGS` / `DECLINED_STRINGS` (az/en/ru, subject + body + detail labels + CTA + footer; mode labels mirror the app's `format_online`/`format_office` values: Onlayn/Kabinet etc.) and exported `buildPaymentDueMail(locale, {psychologist, startAtLabel, mode, price, link})` / `buildRequestDeclinedMail(locale, {psychologist, startAtLabel})` reusing the verification-mail HTML shell (ACCENT/DEEP/MUTED palette, 420px card, CTA pill + raw link). |
| `src/app/api/psych/console/route.ts` | NEW — GET → `consoleList`, POST `{id, action}` → `consoleRespond` with `originFrom(req.headers)`; `force-dynamic`; copied pay-route pattern. |
| `src/components/psych/ScheduleBook.tsx` | Free cells now show bold hour + tiny `t("reserve")` label (aria-label added). Picked form = request form: fit-tag, mode seg, price, `requestHint`, required textarea (`t("messageLabel")`/`messagePlaceholder`, maxLength 1000, `.mood-note` class), submit `sendRequest` → POST `/api/psych/book` (+message) → toast `requestSent` + refresh, `bookError_*` mapping. NEW always-visible CUSTOM TIME section below the legend: `customTitle`/`customHint`, date input (min = tomorrow Baku, max = +60d, computed from a module-scope Baku today for React-Compiler purity), hour select 06..23, mode seg, own required textarea, submit with `custom: true`. Date/select reuse the `.timepick` look via a small inline CONTROL style (no bare-input class exists); textareas reuse `.mood-note`. No globals.css changes. |
| `src/components/psych/BookingsActions.tsx` | Takes `status` prop; Pay button only when `payment==='unpaid' && status==='confirmed'`; `payHint` note rendered above the buttons on confirmed rows; pay failures (e.g. 409 not_confirmed) toast `bookError_*`/generic error; cancel unchanged. |
| `src/app/[locale]/meditation/bookings/page.tsx` | Active list = status ∈ {requested, confirmed, upcoming} AND future; past keeps cancelled/started. Status chip per active row (`statusRequested/Confirmed/Upcoming/Cancelled`), payment tag shown alongside for upcoming rows; passes `status` into BookingsActions; unpaid stat now counts unpaid active rows. |
| `src/app/[locale]/meditation/console/page.tsx` | NEW server page: `requireUser(locale, "/meditation/console")`; non-psychologist → PsychShell + `psychApp.console.noAccess` notice; psychologist → `<PsychShell locale active="console"><ConsolePanel/></PsychShell>`. `generateMetadata` uses the console copy title. |
| `src/components/psych/ConsolePanel.tsx` | NEW client panel: loads GET `/api/psych/console` on mount (loading / error+retry (`errorGeneric` + `quizAgain`) / ready), renders heading/subtitle + PENDING cards (client name+email, Baku date/time via the bookings-page Intl formatter, mode label, price, `wants` message quote, `custom` chip, Confirm/Decline → POST then refetch, optimistic removal from pending) + CONFIRMED section (`confirmedTitle`/`confirmedEmpty`) + UPCOMING section (reuses `bookingsUpcoming`/`bookingsEmptyUpcoming`, no actions). |
| `src/components/psych/PsychShell.tsx` | NOT edited — `active="console"` needs no tweak: no subtab is highlighted, the rail's own `/meditation/console` entry (AppShell mainNav, psychologist-only) self-highlights via pathname, and the Meditation group head stays active. Verified in SSR HTML. |

## Psychologist display name for mails — mechanism

`consoleRespond` loads the appointment row, then: `psychologists_v2.name_key` for `user.psychSlug` → `getMessages({ locale })` (locale = client's `profiles.lang`, default az) → direct index `messages.psychApp[nameKey]` (same key the psychologists page renders via `t(psy.nameKey)`; all 8 name_keys are plain nested keys, e.g. `psyAidaName` → "Dr. Aidə Kərimova"). Falls back to the slug on any failure. Chose this over passing the name from the route because the name_key lookup belongs with the other DB reads in psych-data; `getMessages({ locale })` works fine inside the route handler call chain.

## Console copy resolution (important deviation)

The `psychApp.console.*` keys ship in `messages/*.json` under a **literal flat top-level key `"psychApp.console"`** (like `settingsPage.location`). next-intl v4 **cannot** traverse that (namespace/key resolution walks nested segments only) and additionally logs a non-fatal `INVALID_KEY` console error for dotted keys (pre-existing in dev.log). The DB `i18n_messages` catalog currently has **no** `psychApp.console.*` rows either (read-only check: 1797 rows, none matching), so neither source resolves via `t("console.title")` today. Since I may not edit messages or run the DB sync, the **console PAGE resolves the copy itself**: `getMessages({ locale })` → try nested `messages.psychApp.console` (works after the lead syncs the DB catalog, which rebuilds it nested) → fall back to the literal flat `messages["psychApp.console"]` (works today) → pass a plain `ConsoleCopy` object as props to ConsolePanel. Both shapes stay present in the merged catalog after a sync, so this keeps working either way. All 14 keys consumed exactly as specified.

Other reused keys (no new keys anywhere): `errorGeneric`, `quizAgain` (retry button label), `bookingsUpcoming`, `bookingsEmptyUpcoming`, `payUnpaid`/`payPaid`, `bookError_*`.

## E2E verification transcript (curl only)

Accounts: psychologist `psych.test@prelife.net` (slug aida-k, role psychologist); client created for this test: **`reqtest@prelife.net` / PreLife2026!** (id `b5db287f-…164b`, locale az) — **lead should delete it**.

Baku today = 2026-11-20 (Fri); aida-k availability: Mon/Wed 10–14, Fri 15–19.

```
# 0. signup → devLink → curl devLink (303) → login client (cookie /tmp/c-client.txt)
POST /api/auth/signup {"name":"Request Tester","email":"reqtest@prelife.net",...}
  → 201 {"ok":true,"devLink":"http://localhost:3000/api/auth/verify?token=…&locale=az"}
GET devLink → 303
POST /api/auth/login → {"user":{…,"role":"user","psychSlug":null}}

# 1. schedule-window: aida-k taken in 14d window = []  → Wed 2026-11-25 h11 (inside 10–14)
POST /api/psych/book {"slug":"aida-k","date":"2026-11-25","hour":11,"mode":"online","message":"Yuxu və imtahan stresi …"}
  → 201 {"id":"d6ca9931-daa4-4059-9da1-86c0141d54f9","status":"requested"}

# 2. negatives
same slot again        → 409 {"error":"slot_taken"}
without message        → 400 {"error":"invalid"}
h6 without custom flag → 409 {"error":"slot_closed"}

# 3. custom time (Mon 2026-11-30 h06, outside every block)
POST /api/psych/book {…,"hour":6,"mode":"office","message":"… 06:00 sorğusu, öz vaxtım.","custom":true}
  → 201 {"id":"70219915-6dfe-42fd-88c9-529f5d8a01aa","status":"requested"}
custom 2027-02-28 (beyond 60d) → 400 {"error":"invalid"}
custom 2026-11-18 (past)       → 409 {"error":"slot_past"}

# 4. client pays a REQUESTED row
POST /api/psych/pay {"id":"d6ca9931…"} → 409 {"error":"not_confirmed"}

# 5. psych login (cookie /tmp/c-psych.txt) → {"role":"psychologist","psychSlug":"aida-k"}
GET /api/psych/console (as psych)
  → slug aida-k | pending 2: d6ca9931 (2026-11-25T07:00Z, online, 80 AZN, custom:false,
      client {name:"Request Tester",email:"reqtest@prelife.net"}, message set)
      + 70219915 (2026-11-30T02:00Z, office, custom:true) | confirmed 0 | upcoming 0
GET /api/psych/console (as client) → 401 {"error":"unauthorized"}
POST /api/psych/console {"id":"d6ca9931…","action":"confirm"} → 200 {"ok":true,"status":"confirmed"}
GET  console again → pending 1 | confirmed 1 (payment unpaid, respondedAt set)
POST /api/psych/console {"id":"70219915…","action":"decline"} → 200 {"ok":true,"status":"cancelled"}
POST console confirm same row again → 409 {"error":"not_confirmed"}

# 6. client view + pay
GET /api/psych/bookings → 70219915 cancelled/unpaid (respondedAt set) + d6ca9931 confirmed/unpaid (respondedAt set)
POST /api/psych/pay {"id":"d6ca9931…"} → 200 {"ok":true}
GET /api/psych/bookings → d6ca9931 upcoming + paid; 70219915 cancelled

# overview in-filter: booked one more (Fri 2026-11-27 h16) → /api/psych/overview
  upcoming: [ d6ca9931 upcoming/paid, 19490d22 requested/unpaid ]  (dashboard now shows pending)

# 7. mails: dev.log shows the sendMail outbox dispatch lines (SMTP unconfigured) —
   "[mail:outbox] reqtest@prelife.net Seansınız təsdiqləndi — ödəniş gözlənir"
   "[mail:outbox] reqtest@prelife.net Seans sorğunuz təsdiqlənmədi"
   No [mail:outbox insert] errors, no 500s anywhere. LEAD: please eyeball the two
   mail_outbox rows (kind session_confirmed / session_declined) for the az HTML.

# 8. cleanup (as client): cancel 19490d22 + paid d6ca9931 → 200 {"ok":true"} each.
   Final: client rows all cancelled; psych console pending/confirmed/upcoming all 0.
```

Page renders (curl, cookie-authenticated): `/az|en|ru/meditation/console` 200 with locale-correct copy ("Psixoloq paneli" / "Psychologist console" / "Консоль психолога", `<title>` set); console as client shows the noAccess notice; `/az/meditation/bookings` renders the status chips correctly (active row: "Təsdiqləndi — ödənilib + Ödənilib + Ləğv et", no Pay button on paid rows; declined custom row in past list as "Ləğv edilib"); `/az/meditation/psychologists` renders Reserve-labeled free cells + the custom form (date min 2026-11-21 / max 2027-01-19, hour select 06:00–23:00, textarea maxLength 1000). Rail on the console page: Meditation group head active, console row `aria-current="page"`, no subtab wrongly highlighted.

## Lint

`bun run lint` (oxlint + `tsc --noEmit`) → **exit 0, 0 errors, 31 warnings** — all the pre-existing `prefer-tag-over-role` / `no-noninteractive-tabindex` style shared app-wide (Nav, ProfileEditor, SettingsPage, Toaster…). My files contribute 5 of them, all on markup patterns carried over verbatim from the original ScheduleBook (`.sched-wrap` tabIndex+region, `.psy-filters` role=form, `.seg` role=group).

## Deviations & notes for the lead

1. **Console copy via props, not `t()`** — see above; root cause is the flat `"psychApp.console"` key in messages/*.json (which also triggers next-intl's pre-existing INVALID_KEY dev warning for `settingsPage.location, psychApp.console`). After the next `sync-i18n.mjs` run the nested tree also appears and my nested-first lookup picks it up; nothing further needed. (The .mjs mirrors/JSON were NOT touched by me.)
2. **PsychShell not modified** — `active="console"` highlights no subtab (correct: the console is not one of the section's subtabs; the rail's psychologist-only console link self-highlights by pathname). Deviation from the suggested `active="psychologists"`, which would have wrongly highlighted the public catalog tab.
3. **`custom` flag on console rows** is computed server-side (slot outside every weekly availability block) — the appointments table has no custom column, so this is the truthful derivation; the console shows the `console.custom` chip on those requests.
4. **Custom-time window**: server allows date ∈ [Baku today, today+60d] (past → 409 slot_past; beyond 60d → 400 invalid); UI offers [tomorrow, +60d] (stricter, per brief).
5. **Pre-existing missing key noticed**: `psychApp.colActions` (bookings table header) renders its fallback path "psychApp.colActions" — key absent from BOTH the static catalog and the DB (not caused by this task; the bookings page always had it). Needs a key + sync by whoever owns messages.
6. **Legacy rows**: pre-v3.4 `upcoming`+`unpaid` rows can no longer be paid (pay requires `confirmed`). None exist for real users right now (only test data).
7. ConsolePanel's Confirm/Decline success gives no toast — the row visibly moves sections (pending → confirmed/cancelled) which is the feedback; errors toast `errorGeneric`. Retry button reuses `quizAgain`.
8. **Test account to delete**: `reqtest@prelife.net` (auth user + profiles row + 3 cancelled appointments left in place for audit).
