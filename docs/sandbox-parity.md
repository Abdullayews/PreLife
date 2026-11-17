# Sandbox ↔ Render parity

**The problem it solves** (reported 2026-11-17): the app deployed on Render
and the same app in the sandbox preview "never looked the same" — different
animations, different features, worse performance in the preview. This file
records what was actually different, what was changed, and what is
inherent to dev mode and can not converge.

The deployment target for parity is the production build on Render:
`npm run build` (standalone) + `npm start`. The sandbox runs `next dev`
(Turbopack) on :3000 behind the preview-panel gateway.

## What was actually different

| # | Difference | Cause | Status |
|---|------------|-------|--------|
| 1 | Floating "Next.js dev tools" badge + route-compile spinners in the corner of the preview | `next dev` chrome; never exists in a production build | **Fixed** — `devIndicators: false` in `next.config.ts` |
| 2 | First visit to each page took 0.2–4 s (Turbopack cold compile); Render serves pre-compiled routes in tens of ms | Lazy per-route compilation in dev | **Fixed** — `scripts/warm.mjs` warms every route at server start (see below) |
| 3 | "1 Issue" badge popping up in the preview corner after switching languages | React 19 dev-only console error: re-creating the theme-bootstrap `<script>` element during a cross-locale soft navigation raised the Next.js issues overlay. In production React strips dev warnings — Render never showed it | **Fixed** — theme bootstrap moved above the `[locale]` segment into a true root layout; the script element's fiber is never re-created, so the warning can no longer occur |
| 4 | Signed-out preview vs signed-in Render | Different origins ⇒ different cookies/localStorage. The preview panel starts with no session (and the cookie bar up); on Render the visitor's browser still holds its session | **Inherent** — per-origin storage cannot be shared. Use the demo account `123` / `123` in the preview (seeded lazily on first login) |
| 5 | Slightly higher TTFB per page (~80–300 ms warm vs tens of ms on Render) and unminified client bundles | `next dev` renders without production optimizations and serves chunks `no-store` | **Inherent** to dev mode — a production build is not allowed in the sandbox. The warmup closes the gap that mattered (the 1–4 s first-hit spike); the remaining ~200 ms is not user-visible |

Everything else was audited and is identical by construction — same code,
same browser, same CSS: scroll-driven reveals (`.rv`, `animation-timeline:
view()`), hero `rise`/`drift`, marquee, breath cycle, gallery autoplay,
dark-mode pre-paint, footer stickiness, all trilingual content.

## What was done

1. **`next.config.ts`** — `devIndicators: false`. The dev badge, its
   animations and the compile spinners are gone; the preview renders the
   same chrome as production. (The dev *error overlay* remains for genuine
   runtime errors — that matches production, where errors also surface.)
2. **`scripts/warm.mjs` + `package.json`** — `npm run dev` now starts the
   server in the background, runs the warmup in the foreground, then
   `wait`s on the server. The warmup: polls :3000 until ready, signs in as
   the demo account (which also lazily seeds it on a fresh DB), requests
   every page once with the session cookie (so signed-in surfaces, not
   login redirects, get compiled), hits every API route (GETs normally;
   POSTs with an invalid empty body — handlers validate before any side
   effect, so a 400 compiles the module without touching data), then logs
   out to revoke the warmup session. Fully fault-tolerant: any failure is
   logged and skipped; the script always exits 0 and never affects the dev
   server. Net effect: **first visits now respond in 80–300 ms instead of
   0.2–4 s.**
3. **`src/app/layout.tsx` (new true root layout)**, **`src/app/[locale]/
   layout.tsx`** (now a nested fragment), **`src/components/HtmlLang.tsx`**
   — `<html>/<head>/<body>` and the pre-paint theme script moved above the
   `[locale]` segment. Locale switches re-render the `[locale]` subtree;
   the script element now lives above it, so React keeps the hydrated node
   forever and the dev-only "script tag" warning (and its issues badge) can
   no longer occur. `<html lang>`: static SSR default `en`, corrected
   pre-paint by the bootstrap script from the URL prefix, and kept in sync
   on soft switches by `<HtmlLang>`. The root layout must stay static —
   reading headers()/cookies() there would force every page dynamic and
   destroy the static rendering that keeps Render fast.

## How to re-verify

- `bun run dev`, then watch the first `[warm]` block in the output — every
  line should end in `200`/`400`/`404` (never `5xx`).
- Open the preview: no badge bottom-left, no compile spinner on first
  navigation, TTFB feels instant.
- Switch languages a few times (AZ → EN → RU): no "Issue" badge appears
  (`document.querySelector('nextjs-portal').shadowRoot.textContent` must
  not contain "Issue"), `<html lang>` follows the locale.
- `localStorage.pl-theme = 'dark'` + reload: dark paints immediately, no
  flash.

## Audit trail (2026-11-17, agent-browser)

All 20 routes render with zero console/page errors; login (123/123),
mood check-in, psychologist booking → payment state, AI companion (real
LLM reply), journal save/delete, self-check quiz → score history, audio
playback (HTTP 206), video controls, breath circle, marquee, scroll
reveals, dark mode + pre-paint, AZ/EN/RU switching, 390 px mobile (no
overflow), sticky footer (flush on short pages, pushed on long ones).
