# PreLife (frontend rewrite)

Rewrite of https://github.com/Abdullayews/PreLife at commit `9be5d29`
("fix: pixel-audit pass — nav track, one grid, integer rhythm").

Preserved: routes (`/[locale]/{welcome,home,gym,diet,meditation,library,subscription,ui}`,
locales `az` / `en` / `ru`, default `en`), `messages/*.json` rendered verbatim, per-module
day/night theming, photo hero galleries (dots only, 30 s autoplay, crossfade),
CSS-only motion with `prefers-reduced-motion` handling, storage keys
(`pl-theme`, `prelife.account-active`) and the welcome → home funnel stub.

Rebuilt: layout, components and visual design.

- No Tailwind / Radix / shadcn: one hand-written stylesheet (`src/app/globals.css`).
- Dependencies: next, react, next-intl, lucide-react.
- One `WorldPage` template renders all four modules from `src/lib/worlds.ts`.
- Client bundle receives only the message namespaces it uses.

```
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
```

Not carried over: `scripts/build-messages.mjs` and the per-locale message generators.
`messages/*.json` are copied as generated; re-add the scripts if you still edit copy through them.
