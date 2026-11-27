# PreLife — Member-area playbook (qeydiyyatlı istifadəçi frontend sahəsi)

> **STATUS (2026-11-27, kod bazası `d58c239`): canlı sənəd.**
> İstifadəçi planlaşdırır: "frontendin qeydiyyatlı userlər üçün sahəsi
> dəyişəcək". Konkret dəyişiklik gələndə explorasiya yerinə BURADAN başla.
> Hər member-area dəyişikliyindən sonra bu sənədi güncəllə (STATUS xətti +
> toxunulan yerlər).

## 0. Bu sənəd necə istifadə olunur (özümə qeyd)

Member-area dəyişikliyi gələndə ardıcıllıq:

1. Bölmə 1-dən route-u və faylları tap → birbaşa oxumağa başla (axesarət axtarış yox).
2. Bölmə 2 ilə qatları və data axınını anla.
3. Bölmə 3-dəki uyğun resepti tətbiq et (A–F).
4. Bölmə 4-dəki pozulmaz qaydaları pozma.
5. Bölmə 5 ilə yoxla (lint → dev.log → agent browser).
6. Bölmə 6 ilə commit + push + self-check.
7. Bu sənədi güncəllə (STATUS + yeni fayllar).

## 1. Route xəritəsi (member area = `requireUser` qapılı səhifələr)

Giriş qapısı hər member səhifəsində eynidir:
`requireUser(locale, "<path>")` — sessiya yoxdursa `/login?next=<path>` yönləndirir
(`src/lib/auth.ts`; `SessionUser`: id, email, name, avatar, railFolded,
role, psychSlug, hallSlug, location, premium).

| Route | `src/app/[locale]/…/page.tsx` | Əsas komponent / qeyd |
|---|---|---|
| `/home` | `home/page.tsx` | Dashboard: plan kartı + PICKS; data bir çağırışda `/internal/home` (plan+profile+packages) |
| `/settings` | `settings/page.tsx` | `SettingsPage` — CATS: account, devices, privacy, appearance, language, location, notifications |
| `/profile` | `profile/page.tsx` | `ProfileEditor` |
| `/subscription` | `subscription/page.tsx` | `SubscriptionBuilder` (custom paket) |
| `/gym` | `gym/page.tsx` | `components/idman/IdmanApp` — plan/shop/halls tabları (`GYM_TABS`, `lib/gym.ts`) |
| `/gym/console` | `gym/console/page.tsx` | `components/gym/HallConsole` — role `hall_manager` |
| `/diet` | `diet/page.tsx` | `components/diet/DietShell` + `WaterTracker`; subpages: `places`, `plans`, `recipes` |
| `/meditation` | `meditation/page.tsx` | `components/psych/PsychShell` + `AiPanel` (AI chat) |
| `/meditation/mood` | `meditation/mood/page.tsx` | `MoodCheck` + `MoodCharts` — mood_logs; consent scope `mood` |
| `/meditation/journal` | `meditation/journal/page.tsx` | `JournalCard` + `JournalHistory` — journal_entries; scope `journal` |
| `/meditation/practice` | `meditation/practice/page.tsx` | `AudioPlayerCard`, `VideoCard`, `BreathCircle` |
| `/meditation/tdb` | `meditation/tdb/page.tsx` | TDB (psixoloji tövsiyə) kolleksiyası |
| `/meditation/psychologists` | `meditation/psychologists/page.tsx` | `PsyCard` + `PsychologistFilter` + `ScheduleBook` |
| `/meditation/bookings` | `meditation/bookings/page.tsx` | `BookingsActions` — appointments |
| `/meditation/console` | `meditation/console/page.tsx` | `ConsolePanel` — role `psychologist` |
| `/library` | `library/page.tsx` | `BooksPanel` — shelf `/api/library/shelf` |
| `/admin` | `admin/page.tsx` | `AdminPanel` — role `admin`; başqa rola `noAccess` |

Public (member deyil): `/welcome` (+`/welcome/[slug]`), `/login`, `/signup`,
`/verify`, `/terms`, `/cookies`, `/rules`, `/help`; `/[locale]` → `/welcome`
redirect. Nav modeli (bütün section adları) tek mənbədir: `src/lib/shell.ts`
(`sections` — gym/diet/meditation/library; ad dəyişmək YALNIZ orada).

## 2. Arxitektura qatları (yuxarıdan aşağı)

1. **Route — server component.** Standart pattern (bütün member səhifələri):
   `setRequestLocale` → `requireUser` → `getTranslations` → data (`apiGet`) →
   `<AppPageShell>` içində client komponent. `generateMetadata` → `Metadata`
   namespace.
2. **Shell.** `AppPageShell` (səhifə konteyneri) → `AppShell` v6 (glass rail:
   fold `profiles.rail_folded`, nested subtablar, account dropdown; mobil overlay).
3. **Client komponentlər** — `"use client"` panellər/tablar.
4. **Frontend data layeri:**
   - Server tərəf: `src/lib/server-api.ts` `apiGet()` → `http://127.0.0.1:3030`
     (`API_INTERNAL_URL`), cookie forwarded, `no-store`, 20s timeout, uğursuzluqda
     `null` (səhifə deqradasiya ilə açılır).
   - Client tərəf: `fetch(apiUrl("/api/…"))` — sandboxda `?XTransformPort=`
     avtomatik əlavə olunur (`src/lib/api-url.ts`). Brauzer sorğuları HƏMİŞƏ
     relative `/api/…` path.
   - Sessiya: `/api/auth/me` (backend 30s cache) → `getSessionUser()`.
5. **Backend** — `mini-services/prelife-api` (axum). Route mountları
   `src/routes/mod.rs`-də: `/api/auth/*`, `/api/me/{profile,preferences,
   consents,export}`, `DELETE /api/me`, `/api/devices*`, `/api/psych/*`,
   `/api/ai/chat`, `/api/gym/*`, `/api/admin/console`, `/api/library/shelf*`,
   `/api/subscription/custom`, `/api/content/*`, `/internal/{home,config}`.
   CSRF: unsafe `/api/*` + `/internal/*` sorğularında foreign Origin rədd
   olunur (`origin_guard`); hər cavabda security headers.
6. **DB** — Supabase Postgres: `db/schema.sql` (baza) + `db/schema-v3.x.sql`
   versiyalar (v3.7 `user_consents`, v3.8 `notify_*`; user datası: users,
   sessions, profiles, user_plans, mood_logs, journal_entries, quiz_results,
   meditation_progress, appointments, ai_settings …). Hər cədvəldə RLS;
   yazma yalnız service_role (backend) ilə.
7. **i18n** — `messages/{az,en,ru}.json` (3 faylda EYNİ key ağacı — paritet
   məcburi; AZ default) + DB tərəfi `i18n_messages` + `db/seed-i18n-*.sql`.
   next-intl ICU parametrli keylər (`{count}`); client-də dinamik say üçün
   `t.raw`.

## 3. Dəyişiklik reseptləri (necə edirəm)

**A. Mövcud səhifədə UI/UX dəyişikliyi.**
Route faylı → komponent → `lib/<world>.ts` tiplər → `messages/*.json` 3 dil →
`globals.css` (mövcud utility classları təkrar istifadə et). Sonda bölmə 5.

**B. Settings-ə yeni panel.**
`SettingsPage.tsx`: `CATS` massivinə `{ id, icon }` → panel komponenti →
`{cat === "<id>" && <XPanel />}` → `settingsPage.<id>` namespace 3 dilə.
Persist: hesab səviyyəli seçimlər `/api/me/preferences` (profiles) ilə;
qurğular cihaz səviyyəsindirsə consent-gated localStorage.

**C. Yeni member səhifəsi.**
`src/app/[locale]/<sec>/<slug>/page.tsx` (bölmə 2.1 patterni) → nav: subtab
kimi `AppShell` + `lib/shell.ts`; ayrı route-dursa rail-a əlavə →
`Metadata` + səhifə namespace 3 dilə.

**D. Yeni backend endpoint + DB dəyişikliyi.**
1) `db/schema-v3.<N+1>.sql`: `CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF
NOT EXISTS` + `ENABLE ROW LEVEL SECURITY` + `GRANT … TO service_role,
authenticated` + `COMMENT`. 2) `mini-services/prelife-api/src/routes/<modul>.rs`
handler. 3) `mod.rs`-ə `.route()` mount. 4) Frontend: client `fetch(apiUrl(…))`
yaxud server `apiGet(…)`. 5) Xətalar problem+json (RFC 9457).

**E. Bildiriş / icazə tələb edən feature — İKİ QAT prinsipi.**
1) Brauzer icazəsi: `src/lib/notifications.ts` — `requestNotifPermission()`
YALNIZ user gesture (click) içindən; `denied` → re-prompt YOX, brauzer
ayarlarına yönləndir. 2) Hesab opt-in: kanal seçimləri `profiles.notify_*`
(`/api/me/preferences`), həssas data üçün explicit consent `user_consents`
(`/api/me/consents`; scope: mood/journal/quiz/ai; verilməyibcə
`403 consent_required_<scope>`). Hazır nümunə implementation:
`SettingsPage` → `NotificationsPanel` (iki qat bir ekranda).

**F. Məlumat hüquqları (export / silmə).**
`GET /api/me/export` (JSON export) + `DELETE /api/me` (erasure) — hazır;
UI nümunəsi `SettingsPage` → `PrivacyPanel` (parol təkrar-yoxlaması ilə).

## 4. Pozulmaz qaydalar

- `bun run build` QADAĞDIR. Dev: `bun run dev` (port 3000); backend `:3030`.
- Fake/demo user data YOX — görünən hər istifadəçi datası real DB-dən gəlir.
- localStorage-da token YOX; sessiya `__Host-pl_session` cookie
  (Secure+HttpOnly+SameSite=Lax).
- Brauzer fetch-ləri yalnız relative `/api/…` path (port yazmaq olmaz;
  sandboxda `apiUrl()` XTransformPort əlavə edir).
- API xətaları problem+json; hər yeni cədvəldə RLS.
- i18n: hər görünən string 3 dildə, paritet pozulmaz; AZ default.
- Qonaq üçün pre-consent zero-storage: cookie icazəsindən əvvəl HEÇ BİR yazı.
- AI chat-də `aiDisclaimer` görünür; AI prompt konteksti PII-minimal.
- Commit: conventional commits (feat/fix/docs/chore/refactor/perf/style),
  emoji YOX; hər push-dan sonra GitHub API self-check.
- İstifadəçi datası yalnız sahibinə görünür (admin read-only konsolu istisna).

## 5. Yoxlama workflow-u (hər dəyişiklikdən sonra)

1. `bun run lint` (repo kökündə).
2. Backend dəyişibsə: `cd mini-services/prelife-api && cargo check`.
3. `dev.log`-un son sətirləri — runtime/hydration xətaları.
4. Agent browser: dəyişən axını real işə sal (login → səhifə → klik), mobile
   390px + desktop, console error olmadığını təsdiqlə.
5. Emu testi lazımsa: `SUPABASE_EMU=1`; emu-store dəyişəndə əvvəl köhnə node
   proseslərini öldür.

## 6. Commit + push + self-check (məcburi protokol)

```bash
git add -A && git commit -m "<type>(<scope>): <description>"
TOKEN=$(python3 -c "import json;print(json.load(open('.loop-secrets.json'))['git']['token'])") && GH_TOKEN="$TOKEN" bash scripts/push-github.sh https://github.com/Abdullayews/PreLife.git
```

Self-check: GitHub API `GET /repos/Abdullayews/PreLife/commits/<sha>` →
(1) sha düzgün, (2) author login `Abdullayews`, (3) author+committer email
`08abdullayev@gmail.com`, (4) fayl siyahısı gözlənilən.
Author/committer identikliyi repo-local git config-dən gəlir — dəyişmə.
Force-push / amend / rebase QADAĞDIR.

## 7. Sənədin saxlanması

Hər member-area dəyişikliyində: STATUS xəttini güncəllə (tarix + yeni HEAD
sha) + bölmə 1–3-ə yeni faylları/nöqtələri əlavə et. Bu sənəd köhnəlibsə
(STATUS tarixi > 2 dəyişiklik geridədirsə) əvvəlcə `git log --oneline -10`
ilə fərqi tap, sonra davam et.
