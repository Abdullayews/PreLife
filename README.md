# PreLife

Next.js rewrite of https://github.com/Abdullayews/PreLife — one product, four
worlds: **Gym, Diet, Psychology, Books** (+ Subscription).

## Routes

Locales `az` / `en` / `ru` (default `en`), prefixed: `/en/…`.

| Surface | Route | Access |
| --- | --- | --- |
| Marketing home | `/welcome` | public |
| Section pages | `/welcome/gym`, `/welcome/diet`, `/welcome/meditation`, `/welcome/library` | public |
| App home | `/home` | sign-in required |
| App sections | `/gym`, `/diet`, `/meditation`, `/library` | sign-in required (content to be written) |
| Subscription | `/subscription` | sign-in required |
| Auth | `/login`, `/signup` | public |
| Legal | `/terms`, `/rules` | public |

Legacy addresses `/welcome/psychology` and `/welcome/books` 301-redirect to
`/welcome/meditation` and `/welcome/library` (all locales, `src/proxy.ts`).


## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- next-intl for routing/translations (`messages/*.json`)
- Prisma 7 + SQLite via the better-sqlite3 driver adapter (engine-less),
  cookie sessions, single `User` model
- One hand-written design system (`src/app/globals.css`) — per-module palettes
  via `data-world`, dark mode via `.dark` on `<html>`
- One `WorldPage` template renders all four public section pages from
  `src/lib/worlds.ts`; the client bundle receives only the message namespaces
  it uses

## Develop

```
npm install                # or: bun install
cp .env.example .env       # SQLite file lives in db/
npm run db:push            # create the database + generate the Prisma client
npm run dev                # http://localhost:3000
```

`/` redirects to `/welcome` in the default locale.

## Deploy (Render / any Node host)

- **Runtime**: Node ≥ 20.19 (`.node-version` pins 24)
- **Install**: `npm ci` (uses the committed `package-lock.json`; the
  `allowScripts` allow-list in package.json covers the native builds:
  better-sqlite3, @prisma/engines, prisma, @parcel/watcher, @swc/core,
  unrs-resolver)
- **Build**: `npm run build` — runs `prisma generate` itself, then the
  Next.js standalone build
- **Start**: `npm start` — syncs the SQLite schema (`prisma db push`,
  idempotent) and boots the standalone server on `$PORT`, bound to 0.0.0.0
- **Environment**: `DATABASE_URL` is optional — it defaults to
  `file:./db/custom.db` inside the service. That path is EPHEMERAL on most
  hosts: data resets on
  redeploy. To keep data, mount a persistent disk and set
  `DATABASE_URL=file:/var/data/custom.db` (any writable absolute path).

The standalone server resolves relative `file:` URLs against the project
root automatically (Next chdirs into `.next/standalone` at boot — handled
in `src/lib/db.ts`).
