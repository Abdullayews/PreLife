# prelife-api — the PreLife backend in Rust

The complete backend of PreLife as a standalone **Rust (axum)** service on
**port 3030**. This is a 1:1 port of the backend that previously lived
inside the Next.js app (`src/app/api/*` + `src/lib/server/*` — since
removed): same routes, same JSON shapes, same error codes, same cookies,
same database (Supabase, or the built-in emulator in dev).

## What it serves

| Group | Routes |
|---|---|
| auth | `POST /api/auth/login` `signup` `resend` `logout` `complete`, `GET /api/auth/me` `verify` `callback` `oauth/{google\|apple}` |
| me / devices | `GET|PATCH /api/me/profile`, `GET|PATCH /api/me/preferences`, `GET /api/devices`, `PATCH|DELETE /api/devices/{id}` |
| psych | journal (`GET` `POST` `DELETE/{id}`), mood, quiz, book, cancel, pay, bookings, schedule-window, overview, progress, console, ai |
| gym | `GET|POST|DELETE /api/gym/plan` (the AI questionnaire) |
| subscription | `GET|POST /api/subscription/custom` |
| content | `GET /api/content/{worlds,gym,diet,meditation,library,subscription}`, `GET /api/i18n?locale=` |
| ai | `POST /api/ai/chat` (public assistant with account tools) |
| health | `GET /api/health` |
| emu (dev) | `/api/supa-emu/rest/v1/{table}`, `/api/supa-emu/auth/v1/*` (the local Supabase emulator incl. the OAuth consent page) |
| internal (SSR) | `GET /internal/home`, `GET /internal/config` — the Next.js server components' data layer |

## Architecture

- **axum** HTTP server, **reqwest** for outbound calls (Supabase, Brevo,
  Gemini, z-ai), **serde_json** rows everywhere (insertion-ordered maps —
  JSON key order matches the JS backend).
- `src/supa.rs` — one `Supa` enum, two transports: `Emu` (in-process
  emulator) and `Http` (real Supabase PostgREST/GoTrue with the
  service_role key). Every domain module is transport-agnostic.
- `src/emu.rs` — the Supabase emulator: content tables re-seeded from
  `db/seed-content.sql` on boot, user tables persisted to
  `db/emu-store.json` (debounced write-through), GoTrue-shaped auth
  admin API. DEV only (`SUPABASE_EMU=1` and not production).
- `src/session.rs` — `pl_session` cookie sessions (sha256 token hashing,
  sliding 1-year TTL, 30s lookup cache, device tracking) + the v4.7
  hardened `origin_from`.
- `src/ai/` — the provider chain: **Gemini** (with account function
  tools for signed-in users) → **z-ai** (the `.z-ai-config` HTTP API —
  the SDK is a plain fetch wrapper, called directly from Rust). No
  canned replies: both failing → honest `503 ai_unavailable`.
- `src/mail.rs` — Brevo API + the `mail_outbox` catch-all (the legacy
  SMTP/nodemailer path was dropped; Brevo is the production transport).
- Caches: sessions 30s, preferences 30s, content/i18n/AI-settings 60s,
  rate-limit fixed windows — all in-process, like the TS backend.

## Environment

Reads the repo-root `.env` (via `PRELIFE_ROOT`, set by `watch.mjs` /
`dev-backend.mjs`); real env vars win. Keys:

| Key | Meaning |
|---|---|
| `SUPABASE_EMU=1` | use the in-process emulator (dev only) |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | the real project (production) |
| `BREVO_API_KEY`, `MAIL_FROM` | mail transport |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | primary AI provider (env wins over `ai_settings`) |
| `PUBLIC_URL`, `NEXT_PUBLIC_SITE_URL` | origin allowlist for redirects/links |
| `API_TRANSFORM_PORT` | sandbox gateway suffix for browser-facing URLs (unset in production) |
| `PRELIFE_API_PORT` | listen port (default 3030) |
| `NODE_ENV=production` | production mode (disables the emulator, dev links, localhost origins) |

## Dev

```
bun run dev            # watcher: cargo build + run + restart on .rs changes
cargo build            # plain build
```

The main app's `bun run dev` starts this service automatically via
`scripts/dev-backend.mjs` (idempotent — skips if :3030 answers).

## Production

```
cargo build --release
PRELIFE_ROOT=/srv/prelife NODE_ENV=production ./target/release/prelife-api
```

Run it next to the Next.js server and route `/api/*` to it at the edge
(Caddy/nginx: `handle /api/* { reverse_proxy 127.0.0.1:3030 }`). Leave
`API_TRANSFORM_PORT` unset — the frontend then calls plain `/api/*`
paths on the same origin.

## Layout

```
src/
  main.rs        boot, router, graceful shutdown (persists the emu store)
  config.rs      env + .env loading, z-ai config discovery
  error.rs       ApiError / DomainError (the ApiCode contract) / SupaError
  util.rs        time, baku wall-clock, tokens, encoding, msg-tree helpers
  supa.rs        the PostgREST/GoTrue client (Emu | Http)
  emu.rs         the local Supabase emulator (store + seed-SQL parser)
  session.rs     cookie sessions, caches, origin resolution
  rate_limit.rs  (in state.rs) fixed-window counters + the mail guard
  mail.rs        Brevo + outbox + the three branded templates
  verification.rs  e-mail tokens, the v4.6 mail-registration start
  content.rs     worlds/gym/diet/meditation/library/subscription catalogs
  messages.rs    static messages/*.json + DB i18n overlay
  psych.rs       journal/mood/quiz/bookings/console/overview
  account.rs     preferences + devices
  profile.rs     profile view/update, weight history
  packages.rs    custom subscription packages (server-side pricing)
  user_plans.rs  workout plans: default starter, AI generation, fallback
  ai/            provider chain, prompts, gemini.rs, zai.rs
  routes/        the axum handlers (auth, psych, content, gym, …)
```
