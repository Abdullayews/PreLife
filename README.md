# PreLife

One product, four worlds: **Gym, Diet, Psychology, Books** (+ Subscription).

## Architecture (v5.0 — Rust backend + Next.js frontend)

```
Browser ──▶ Next.js 16 (App Router, port 3000)          the FRONTEND
              │  UI (React 19, next-intl), no API routes of its own
              │  SSR data layer ──▶ /internal/* on the backend (lib/server-api.ts)
              │
              ▼  /api/* (browser calls, same origin via the edge proxy)
         prelife-api — RUST (axum) on :3030                the BACKEND
         (mini-services/prelife-api — same routes, JSON shapes, error
          codes and pl_session cookies as the TS backend it replaced)
              │  PostgREST + GoTrue admin (service_role), Brevo mail,
              │  Gemini → z-ai AI chain, in-process caches
              ▼
         Supabase Postgres — THE single source of truth
         (all content, the full i18n catalog, auth, user data)
```

- **Backend**: `mini-services/prelife-api` — a standalone Rust (axum)
  service. Supabase access runs through one `Supa` abstraction with two
  transports: the real project (PostgREST + GoTrue with the service_role
  key) or, in the dev sandbox, the built-in emulator (`src/emu.rs`,
  `SUPABASE_EMU=1`). Mail is Brevo HTTP API + the `mail_outbox` fallback.
  Sessions are `pl_session` cookies (sha256-hashed tokens, sliding 1-year
  TTL, 30s cache, device tracking). Its full README — route table, env
  vars, layout — lives at `mini-services/prelife-api/README.md`.
- **Frontend**: Next.js 16 (App Router) + React 19 + TypeScript
  (compiled with tsc-rs) + next-intl. No data is hardcoded — every page
  reads its content from the backend (`src/lib/server-api.ts` for server
  components, `src/lib/api-url.ts` for the browser); the message catalogs
  are database-driven too (`src/i18n/request.ts` loads the backend's
  `/api/i18n`, with the bundled `messages/*.json` as fallback).
- **Database** (Supabase): `i18n_messages` (1646 keys × az/en/ru), the
  four content worlds, gym, diet, psychology (8 psychologists, media,
  quizzes), library, subscriptions (Plus/Pro/Ultra + à-la-carte
  features), and user data (profiles, sessions, appointments, mood logs,
  journal, quiz results, meditation progress, plans, custom packages).
  RLS is enabled everywhere; only the service_role (the Rust backend)
  can read/write.
- **Auth flow** (v4.3–v4.6 decisions): mail-first activation — an unknown
  e-mail at login starts registration automatically (pending account +
  confirmation mail); OAuth (Google/Apple) is provider-aware with PKCE;
  a pending account cannot be entered until completed.

## Routes (frontend)

Locales `az` / `en` / `ru` (default `en`), prefixed: `/en/…`.

| Surface | Route | Access |
| --- | --- | --- |
| Marketing home | `/welcome` | public |
| Section pages | `/welcome/gym`, `/welcome/diet`, `/welcome/meditation`, `/welcome/library` | public |
| App home | `/home` | sign-in required |
| App sections | `/gym`, `/diet`, `/meditation`, `/library` | sign-in required |
| Subscription | `/subscription` | sign-in required |
| Auth | `/login`, `/signup`, `/verify` | public |
| Legal | `/terms`, `/rules` | public |

Legacy addresses `/welcome/psychology` and `/welcome/books` 301-redirect to
`/welcome/meditation` and `/welcome/library` (all locales, `src/proxy.ts`).

There is **no demo account**: accounts live in Supabase Auth
(`auth.users` + `public.profiles`), passwords are verified by GoTrue's
password grant, and users sign up with email + password or Google/Apple.

## Develop

```
bun install                          # deps (Rust toolchain: rustup)
cp .env.example .env                 # SUPABASE_EMU=1 works out of the box
bun run dev                          # backend :3030 + Next.js :3000
```

`bun run dev` chains three scripts:
`scripts/dev-backend.mjs` builds and starts the Rust backend on :3030
(idempotent, logs to `/tmp/prelife-api.log`), `next dev` serves the
frontend on :3000 (`dev.log`), `manifest-guard.mjs` watches the Next 16
dev-mode prerender-manifest write race, and `scripts/warm.mjs` requests
every route once so the first real visit is not a cold compile.

`bun run dev:backend` runs the backend's own watcher (cargo build + run +
restart on .rs changes) without the frontend.

### Database setup (a FRESH Supabase project)

`node scripts/apply-db.mjs` (mode "all") applies `db/schema.sql` + seeds
— that is the v2-era base only. A new project needs the full migration
chain, in order:

```
node scripts/apply-db.mjs          # schema.sql + seed-content + seed-i18n
node scripts/apply-db.mjs v3       # Supabase-Auth layer (profiles, …)
node scripts/apply-db.mjs v3.1     # auth re-pointing (drops legacy users)
node scripts/apply-db.mjs v3.2     # user preferences (lang/theme)
node scripts/apply-db.mjs v3.3     # ai_settings/prompts, plans, verification
node scripts/apply-db.mjs v3.4     # booking-request workflow
```

Then sync the i18n catalog (upsert, safe to re-run):
`node scripts/sync-i18n.mjs`.

### Content pipeline

Content lives in the database (`db/seed-content.sql` is the seed; the
emulator re-seeds from it on boot). Edit rows in Supabase — the app
picks changes up within the backend's 60s cache window. To refresh the
catalog in the DB after editing `messages/*.json`, run `scripts/
sync-i18n.mjs` (upsert-only; never partially empties the table).

### API surface

Served by the Rust backend (same origin through the edge proxy in
production; `:3030` with the sandbox gateway param in dev):

Content: `GET /api/content/{worlds,gym,diet,meditation,library,subscription}` ·
`GET /api/i18n?locale=az|en|ru` · `GET /api/health`
Auth: `POST /api/auth/{signup,login,resend,complete,logout}` ·
`GET /api/auth/{me,verify,callback}` ·
`GET /api/auth/oauth/{google,apple}` (PKCE)
Account: `GET|PATCH /api/me/profile` · `GET|PATCH /api/me/preferences` ·
`GET /api/devices` · `PATCH|DELETE /api/devices/{id}`
Psychology: `GET|POST /api/psych/journal` · `DELETE /api/psych/journal/{id}` ·
`GET|POST /api/psych/mood` · `POST /api/psych/quiz` ·
`GET|POST /api/psych/book` · `POST /api/psych/{cancel,pay,progress,console}` ·
`GET /api/psych/{bookings,schedule-window,overview}` · `POST /api/psych/ai`
Gym plans: `GET|POST|DELETE /api/gym/plan`
Subscription: `GET|POST /api/subscription/custom`
AI: `POST /api/ai/chat` (public)
SSR internal: `GET /internal/{home,config}`

## Deploy

- **Rust backend**: `cargo build --release`, run it next to the Next.js
  server (`PRELIFE_ROOT=/srv/prelife NODE_ENV=production
  ./target/release/prelife-api`), and route `/api/*` to `127.0.0.1:3030`
  at the edge (Caddy: `handle /api/* { reverse_proxy 127.0.0.1:3030 }`).
  It must NOT be reachable from the public internet except through the
  trusted proxy (the rate limiter reads `X-Forwarded-For`).
- **Next.js frontend**: Node ≥ 22.9 (`npm ci` — `package-lock.json` is
  committed; `bun.lock` stays the dev-sandbox lockfile).
  `npm run build` → standalone server on `$PORT`. Set `SUPABASE_URL` +
  `SUPABASE_SERVICE_ROLE_KEY` + `BREVO_API_KEY` + `PUBLIC_URL`; see
  `.env.production.example` (including `API_INTERNAL_URL` when the
  backend lives on a separate host).
- **Database**: Supabase Postgres — nothing to host. Apply schema changes
  with the migration chain above (`node scripts/apply-db.mjs …`).

### Auth providers

OAuth (Google / Apple) runs through Supabase Auth with PKCE:
`GET /api/auth/oauth/{google,apple}` → GoTrue `/authorize` →
`GET /api/auth/callback` exchanges the code and mints the `pl_session`.
**Google is configured** (client credentials live in
Supabase → Authentication → Providers); its authorized redirect URI in
Google Cloud Console must stay
`https://zfoafweipekpuqsfsype.supabase.co/auth/v1/callback`. Apple still
needs its Services ID + key (Apple Developer Program) pasted into the
same Supabase screen — until then the Apple button answers
`missing OAuth client ID`.

## Troubleshooting / environment

| Variable | Where | Needed by |
| --- | --- | --- |
| `SUPABASE_EMU=1` | `.env` (dev only) | the built-in Supabase emulator |
| `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | `.env` / host env | the Rust backend (production) |
| `BREVO_API_KEY` + `MAIL_FROM` | `.env` / host env | the Rust backend's mail transport |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | `.env` / host env | the backend's primary AI provider |
| `PUBLIC_URL` / `NEXT_PUBLIC_SITE_URL` | `.env` / host env | origin allowlist (redirects, links, cookies) |
| `API_INTERNAL_URL` | host env (prod) | Next SSR → backend (`127.0.0.1:3030` default) |
| `SUPABASE_ACCESS_TOKEN` (`sbp_…`) | `.env` (dev only) | `scripts/apply-db.mjs` migrations |
| `GH_TOKEN` | shell env only | `scripts/push-github.sh` (never stored) |

- **Degraded mode**: without `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`
  (and without `SUPABASE_EMU=1`) the backend still boots but every
  `/api/*` route (except `/api/health`) answers
  `503 {"error":"supabase_unconfigured"}` and the auth forms show a clear
  "server is not connected to the database" message.
  `GET /api/health` reports `"version"` and `"supabaseConfigured"` —
  check it first.
- **Lint**: `bun run lint` = oxlint + tsc (tsc-rs). There is no separate
  backend linter — `cargo clippy` inside `mini-services/prelife-api`.
- **After a sandbox/host restart**: `.env` secrets are not persisted —
  re-paste the keys.
