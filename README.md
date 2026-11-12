# PreLife

Next.js rewrite of https://github.com/Abdullayews/PreLife — one product, four
worlds: **Gym, Diet, Psychology, Books** (+ Subscription).

## Routes

Locales `az` / `en` / `ru` (default `en`), prefixed: `/en/…`.

| Surface | Route | Access |
| --- | --- | --- |
| Marketing home | `/welcome` | public |
| Section pages | `/welcome/gym`, `/welcome/diet`, `/welcome/psychology`, `/welcome/books` | public |
| App home | `/home` | sign-in required |
| App sections | `/gym`, `/diet`, `/meditation`, `/library` | sign-in required (content to be written) |
| Subscription | `/subscription` | sign-in required |
| Auth | `/login`, `/signup` | public |
| Legal | `/terms`, `/rules` | public |

A static demo account is seeded automatically: email `123`, password `123`.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- next-intl for routing/translations (`messages/*.json`)
- Prisma + SQLite (single `User` model, cookie sessions)
- One hand-written design system (`src/app/globals.css`) — per-module palettes
  via `data-world`, dark mode via `.dark` on `<html>`
- One `WorldPage` template renders all four public section pages from
  `src/lib/worlds.ts`; the client bundle receives only the message namespaces
  it uses

## Develop

```
bun install                # or npm install
cp .env.example .env       # SQLite file lives in db/
bun run db:push            # create the database
bun run dev                # http://localhost:3000
```

`/` redirects to `/welcome` in the default locale.
