import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["az", "en", "ru"],
  defaultLocale: "en",
  // next-intl writes a NEXT_LOCALE cookie on its own — both from its
  // middleware and from client-side navigation — which would leave a
  // cookie on the visitor's machine even BEFORE cookie consent. Disabled
  // here; the cookie is managed manually (src/lib/consent.ts writes it
  // only after consent, src/proxy.ts reads it for the language-aware
  // redirect of unprefixed paths).
  localeCookie: false,
});

export type Locale = (typeof routing.locales)[number];
