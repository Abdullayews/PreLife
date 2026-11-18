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

A static demo account is seeded automatically: email `123`, password `123`.
Per the V1 product decision every visitor renders as signed in (preview
user), and their journal/booking actions act as the demo account.

## Develop

```
bun install                          # frontend deps
cp .env.example .env                 # + fill in the Supabase vars
node scripts/apply-db.mjs            # apply db/schema.sql + seeds to Supabase
cd mini-services/prelife-api && cargo build   # or: bun run dev (auto-restart)
bun run dev                          # Next.js on :3000 (warms every route)
```

`bun run dev` also runs `scripts/warm.mjs`: once the server answers it
requests every route once (pages with a demo-account session, Rust APIs
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
- **Rust API**: build `mini-services/prelife-api` (`cargo build --release`),
  run with `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in the environment
  (port via `PORT`, default 3031).
- **Database**: Supabase Postgres — nothing to host. Apply schema changes
  with `node scripts/apply-db.mjs schema`.
