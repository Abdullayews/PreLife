# PreLife

One product, four worlds: **Gym, Diet, Psychology, Books** (+ Subscription).

## Architecture (v2 — Rust backend, Supabase Postgres)

```
Browser ──▶ Next.js 16 (port 3000, UI only)
              │  server components fetch directly
              │  client fetches go through the gateway (?XTransformPort=3031)
              ▼
         prelife-api — 100% Rust (axum, port 3031, mini-services/prelife-api)
              │  PostgREST, service_role key, in-memory TTL cache
              ▼
         Supabase Postgres — THE single source of truth
         (all content, the full i18n catalog, user data)
```

- **Frontend**: Next.js 16 (App Router) + React 19 + TypeScript + next-intl.
  No data is hardcoded anymore — every page fetches its content from the
  Rust API (`src/lib/api.ts`); the message catalogs are database-driven too
  (`src/i18n/request.ts` loads `i18n_messages` via the API, with the bundled
  `messages/*.json` as a fallback).
- **Backend**: `mini-services/prelife-api` — an axum service that serves the
  content endpoints, auth (scrypt + cookie sessions), devices, and the whole
  psychology module (journal, mood, quizzes, bookings, media progress, AI
  companion). It talks to Supabase through PostgREST and caches responses
  for 60 s. The AI chat calls the same z-ai HTTP API the Node SDK used
  (config from `.z-ai-config`), with calm canned fallbacks.
- **Database** (Supabase, 51 tables in 8 groups): `i18n_messages` (≈1300
  keys × az/en/ru), the four content worlds (plans, items, schedules,
  places), gym (halls, equipment, trainers, stores, 40 products, workouts),
  diet, psychology (8 psychologists, media, quizzes), library, subscriptions
  (Plus/Pro/Ultra + à-la-carte features), and user data (users, sessions,
  appointments, mood logs, journal, quiz results, meditation progress).
  RLS is enabled on every table with no policies — only the service_role
  (the Rust backend) can read/write.

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

Since the v3.1 auth migration accounts live in
Supabase Auth (`auth.users` + `public.profiles`), passwords are verified by
GoTrue's password grant, and users sign up normally with email + password.
The legacy `public.users` table (scrypt hashes)
was dropped — code older than commit `95d5120` cannot log in anymore.

## Develop

```
bun install                          # frontend deps
cp .env.example .env                 # + fill in the Supabase vars
node scripts/apply-db.mjs            # apply db/schema.sql + seeds to Supabase
cd mini-services/prelife-api && cargo build   # or: bun run dev (auto-restart)
bun run dev                          # Next.js on :3000 (warms every route)
```

`bun run dev` also runs `scripts/warm.mjs`: once the server answers it
with GET or invalid-JSON POSTs), so the first real visit to any page is
not a 0.2–4 s cold compile.

### Content pipeline

The static content in `src/lib/*.ts` and `messages/*.json` was exported into
the database once with `bun scripts/export-content.mjs` (generates
`db/seed-content.sql` + `db/seed-i18n-*.sql`; committed for reference).
To change content now, edit the rows in Supabase — the API picks up
changes within its 60 s cache window. Re-running the exporter OVERWRITES
the DB content from the TS files, so only do that deliberately.

### API surface (Rust, port 3031)

Content: `GET /api/content/{worlds,gym,diet,meditation,library,subscription}` ·
`GET /api/i18n?locale=az|en|ru` · `GET /api/health`
Auth: `POST /api/auth/{signup,login,logout}` · `GET /api/auth/me`
Devices: `GET /api/devices` · `PATCH|DELETE /api/devices/{id}`
Psychology: `GET|POST /api/psych/journal` · `DELETE /api/psych/journal/{id}` ·
`GET|POST /api/psych/mood` · `POST /api/psych/quiz` ·
`GET|POST /api/psych/book` · `POST /api/psych/{cancel,pay,progress}` ·
`GET /api/psych/{bookings,schedule-window,overview}`
AI: `POST /api/ai/chat` (public) · `POST /api/psych/ai` (companion)

Browser code must call these through the sandbox gateway:
`apiUrl("/api/...")` (see `src/lib/api-url.ts`) — the gateway routes
`?XTransformPort=3031` to the Rust service. Server components use
`API_BASE` directly (`src/lib/api.ts`).

## Deploy

- **Frontend**: Node ≥ 20.19 (`npm ci` — `package-lock.json` is committed;
  `bun.lock` stays the dev-sandbox lockfile). `npm run build` → standalone
  Next server on `$PORT`. Set `PRELIFE_API_URL` to the deployed API origin.
  Browser `/api/*` calls are proxied to it in-app
  (`src/app/api/[...path]/route.ts`), so a single-origin deployment (Render)
  needs no external reverse proxy — the sandbox gateway's `?XTransformPort`
  hint is stripped automatically. If the API is unreachable during the
  build, content pages prerender the graceful offline shell
  (`src/components/ContentUnavailable.tsx`) and ISR swaps in real content
  within 60 s of the API recovering.
- **Rust API**: on Render create a **Docker** Web Service (runtime:
  Docker, root directory `mini-services/prelife-api` — the `Dockerfile`
  is committed). Run it with `SUPABASE_URL` +
  `SUPABASE_SERVICE_ROLE_KEY` in the environment (port via `PORT`,
  default 10000; Render injects it automatically). Without Docker, build
  `cargo build --release` on any host with a Rust toolchain and run
  `./target/release/prelife-api` the same way.
- **Database**: Supabase Postgres — nothing to host. Apply schema changes
  with `node scripts/apply-db.mjs schema`.
- **v3 unified schema** (`db/schema-v3.sql`, applied on top of v2 with
  `node scripts/apply-db.mjs v3`): the Supabase-Auth-based layer —
  `profiles` (FK to `auth.users`, auto-created by the `on_auth_user_created`
  trigger), subscriptions + `plan_sections` (psychology/diet/sports/books/ai,
  gated by `has_section_access()`), `bookings`/`psychologist_slots`/`payments`,
  `mood_checkins`, `journal_entries`, `practice_materials`/`practice_sessions`,
  `exercises`/`workouts`/`workout_exercises`/`user_workout_*`, and
  `books`/`user_books`/`book_notes`. RLS policies give `authenticated` users
  access to their own rows; writes to bookings/payments/subscriptions stay
  server-side (service_role). The two v2 tables whose names the v3 schema
  reuses were renamed (`psychologists_v2`, `journal_entries_v2`) and the live
  Rust backend points at the new names — the site never went down. Content
  was migrated into the v3 tables with Azerbaijani text resolved from
  `i18n_messages` (8 psychologists + 192 bookable slots for the next 14 days,
  Plus/Pro/Ultra plans + sections, 15 exercises, 3 workouts + 47 rows,
  6 books, 16 practice materials).
- **v3.1 auth (db/schema-v3.1-auth.sql)** — login verification fully in the
  database: signup goes through the Supabase Auth admin API (auto-confirmed;
  the `handle_new_user` trigger creates the `profiles` row) and login is
  verified by GoTrue's password grant. `public.sessions` gained
  `user_email`/`user_name` (the session carries the user snapshot) and the
  six user-data FKs (`sessions`, `journal_entries_v2`, `mood_logs`,
  `quiz_results`, `meditation_progress`, `appointments`) were re-pointed to
  `auth.users`. The legacy custom-auth table `public.users` (scrypt hashes,
  its legacy rows) were removed — there
  is no built-in login; sign up normally instead.

## Troubleshooting / environment

| Variable | Where | Needed by |
| --- | --- | --- |
| `SUPABASE_URL` | `.env` / host env | Rust API (PostgREST + GoTrue) |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env` / host env | Rust API (service role — bypasses RLS) |
| `SUPABASE_ACCESS_TOKEN` (`sbp_…`) | `.env` (dev only) | `scripts/apply-db.mjs` migrations |
| `PRELIFE_API_URL` | host env (Render) | Next.js server components + `/api` proxy |
| `GH_TOKEN` | shell env only | `scripts/push-github.sh` (never stored) |

- **Degraded mode**: if `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` are
  missing, prelife-api still boots but every `/api/*` route (except
  `/api/health`) answers `503 {"error":"supabase_unconfigured"}` and the
  auth forms show a clear "server is not connected to the database" message
  instead of a vague generic error. `GET /api/health` reports
  `"supabaseConfigured": false`.
- **Deploy order matters**: the database is already on v3.1 (Supabase Auth,
  `public.users` dropped). Any deployment running code older than commit
  `95d5120` breaks login/signup with `500 generic` ("Something went wrong")
  because the old code queries the dropped table. Deploy the current `main`
  and the flow works again.
- **After a sandbox/host restart**: `.env` secrets are not persisted —
  re-paste `SUPABASE_SERVICE_ROLE_KEY` (backend) and, for migrations,
  `SUPABASE_ACCESS_TOKEN`.
