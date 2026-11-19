# PreLife

One product, four worlds: **Gym, Diet, Psychology, Books** (+ Subscription).

## Architecture (v2.1 — one service: merged Next.js backend)

```
Browser ──▶ Next.js 16 (App Router, port 3000 / $PORT)
              │  UI (React 19, next-intl) + the merged backend:
              │    /api/* route handlers  (src/app/api/**)
              │    server data layer      (src/lib/server/*)
              │  PostgREST + GoTrue admin, service_role key,
              │  in-process 60 s TTL cache
              ▼
         Supabase Postgres — THE single source of truth
         (all content, the full i18n catalog, auth, user data)
```

- **One deployment**: the former Rust service (`prelife-api`, port 3031) was
  merged into the Next.js app 1:1 — every endpoint, session format and error
  code is identical, so existing `pl_session` cookies keep working. Server
  components call the same assembly code directly (`src/lib/api.ts` — no HTTP
  hop); browser code fetches plain relative `/api/...` URLs
  (`src/lib/api-url.ts`). There is **no second service to run**.
- **Frontend**: Next.js 16 (App Router) + React 19 + TypeScript + next-intl.
  No data is hardcoded — every page reads its content from the database
  (`src/lib/api.ts`); the message catalogs are database-driven too
  (`src/i18n/request.ts` loads `i18n_messages`, with the bundled
  `messages/*.json` as a fallback).
- **Backend** (inside this app): `/api` route handlers serve the content
  endpoints, auth (Supabase Auth + cookie sessions), devices, and the whole
  psychology module (journal, mood, quizzes, bookings, media progress, AI
  companion via the z-ai SDK). `src/lib/server/supa.ts` talks to Supabase
  through PostgREST/GoTrue with the service_role key; content responses are
  cached 60 s in-process (`src/lib/server/ttl.ts`).
- **Database** (Supabase): `i18n_messages` (≈1300 keys × az/en/ru), the four
  content worlds, gym, diet, psychology (8 psychologists, media, quizzes),
  library, subscriptions (Plus/Pro/Ultra + à-la-carte features), and user
  data (profiles, sessions, appointments, mood logs, journal, quiz results,
  meditation progress). RLS is enabled everywhere; only the service_role
  (this app's server) can read/write.

## Routes

Locales `az` / `en` / `ru` (default `en`), prefixed: `/en/…`.

| Surface | Route | Access |
| --- | --- | --- |
| Marketing home | `/welcome` | public |
| Section pages | `/welcome/gym`, `/welcome/diet`, `/welcome/meditation`, `/welcome/library` | public |
| App home | `/home` | sign-in required |
| App sections | `/gym`, `/diet`, `/meditation`, `/library` | sign-in required |
| Subscription | `/subscription` | sign-in required |
| Auth | `/login`, `/signup` | public |
| Legal | `/terms`, `/rules` | public |

Legacy addresses `/welcome/psychology` and `/welcome/books` 301-redirect to
`/welcome/meditation` and `/welcome/library` (all locales, `src/proxy.ts`).

Accounts live in Supabase Auth
(`auth.users` + `public.profiles`), passwords are verified by GoTrue's
password grant, and users sign up normally with email + password (or
Google — see below).

## Develop

```
bun install                          # deps
cp .env.example .env                 # + fill in the Supabase vars
node scripts/apply-db.mjs            # apply db/schema.sql + seeds to Supabase
bun run dev                          # Next.js on :3000 — that's all
```

`bun run dev` also runs `scripts/warm.mjs`: once the server answers it
requests every route once (pages, plus API GETs / invalid-JSON POSTs), so
the first real visit to any page is not a 0.2–4 s cold compile.

### Content pipeline

The static content in `src/lib/*.ts` and `messages/*.json` was exported into
the database once with `bun scripts/export-content.mjs` (generates
`db/seed-content.sql` + `db/seed-i18n-*.sql`; committed for reference).
To change content now, edit the rows in Supabase — the app picks up changes
within its 60 s cache window. Re-running the exporter OVERWRITES the DB
content from the TS files, so only do that deliberately.

### API surface (this app, same origin)

Content: `GET /api/content/{worlds,gym,diet,meditation,library,subscription}` ·
`GET /api/i18n?locale=az|en|ru` · `GET /api/health`
Auth: `POST /api/auth/{signup,login,logout}` · `GET /api/auth/me` ·
`GET /api/auth/oauth/{google,apple}` → `GET /api/auth/callback`
Account: `GET|PATCH /api/me/preferences` (language + theme) ·
`GET /api/devices` · `PATCH|DELETE /api/devices/{id}`
Psychology: `GET|POST /api/psych/journal` · `DELETE /api/psych/journal/{id}` ·
`GET|POST /api/psych/mood` · `POST /api/psych/quiz` ·
`GET|POST /api/psych/book` · `POST /api/psych/{cancel,pay,progress}` ·
`GET /api/psych/{bookings,schedule-window,overview}`
AI: `POST /api/ai/chat` (public) · `POST /api/psych/ai` (companion)

## Deploy (single service)

- **Render / any Node host**: Node ≥ 20.19 (`npm ci` — `package-lock.json`
  is committed; `bun.lock` stays the dev-sandbox lockfile). `npm run build` →
  standalone Next server on `$PORT`. Set **`SUPABASE_URL`** +
  **`SUPABASE_SERVICE_ROLE_KEY`** in the service environment — that is the
  whole configuration. The old separate `prelife-api` Render service (Docker,
  root `mini-services/prelife-api`) is **no longer needed — delete it**; this
  app serves `/api/*` itself. If the DB is unreachable during the build,
  content pages prerender the graceful offline shell and ISR swaps in real
  content within 60 s of recovery.
- **Database**: Supabase Postgres — nothing to host. Apply schema changes
  with `node scripts/apply-db.mjs schema`.
- **v3 unified schema** (`db/schema-v3.sql`): the Supabase-Auth-based layer —
  `profiles` (FK to `auth.users`, auto-created by the `on_auth_user_created`
  trigger), subscriptions + `plan_sections` (gated by `has_section_access()`),
  `bookings`/`psychologist_slots`/`payments`, `mood_checkins`,
  `journal_entries`, `practice_materials`/`practice_sessions`,
  `exercises`/`workouts`/`workout_exercises`/`user_workout_*`, and
  `books`/`user_books`/`book_notes`.
- **v3.1 auth (`db/schema-v3.1-auth.sql`)**: login verification fully in the
  database — signup through the Supabase Auth admin API (auto-confirmed; the
  `handle_new_user` trigger creates the `profiles` row), login via GoTrue's
  password grant. `public.sessions` carries the user snapshot. The legacy
- **v3.2 user preferences + OAuth (`db/schema-v3.2-preferences.sql`)**: the
  signed-in user's language and dark/light theme live on the profile row
  (`profiles.lang`, `profiles.theme`): the Nav / Settings toggles save via
  `PATCH /api/me/preferences`, and `UserPrefsSync` applies the account choice
  on every device at load. Guests keep the consent-tiered
  cookie/localStorage behaviour. OAuth (Google / Apple) runs through
  Supabase Auth with PKCE: `GET /api/auth/oauth/{google,apple}` → GoTrue
  `/authorize` → `GET /api/auth/callback` exchanges the code and mints the
  `pl_session`. **Google is configured** (client credentials live in
  Supabase → Authentication → Providers); its authorized redirect URI in
  Google Cloud Console must stay
  `https://zfoafweipekpuqsfsype.supabase.co/auth/v1/callback`. Apple still
  needs its Services ID + key (Apple Developer Program) pasted into the same
  Supabase screen — until then the Apple button answers
  `missing OAuth client ID`.

## Troubleshooting / environment

| Variable | Where | Needed by |
| --- | --- | --- |
| `SUPABASE_URL` | `.env` / host env | merged backend (PostgREST + GoTrue) |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env` / host env | merged backend (service role — bypasses RLS) |
| `SUPABASE_ACCESS_TOKEN` (`sbp_…`) | `.env` (dev only) | `scripts/apply-db.mjs` migrations |
| `GH_TOKEN` | shell env only | `scripts/push-github.sh` (never stored) |

- **Degraded mode**: if `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` are
  missing, the app still boots but every `/api/*` route (except
  `/api/health`) answers `503 {"error":"supabase_unconfigured"}` and the
  auth forms show a clear "server is not connected to the database" message.
  `GET /api/health` reports `"supabaseConfigured": false` — check it first.
- **Render checklist**: web service env has both `SUPABASE_*` vars ·
  the old prelife-api service is deleted (or at least idle) ·
  `curl https://prelife.net/api/health` shows `"version":"2.1.0"` and
  `"supabaseConfigured":true`.
- **After a sandbox/host restart**: `.env` secrets are not persisted —
  re-paste `SUPABASE_SERVICE_ROLE_KEY` and, for migrations,
  `SUPABASE_ACCESS_TOKEN`.
