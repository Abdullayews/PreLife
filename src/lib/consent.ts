/**
 * Cookie-consent state and preference persistence.
 *
 * Visitor preferences (theme, locale) are stored in two tiers:
 *
 *  - BEFORE consent: in memory only. The theme lives in a module-level
 *    variable (survives client-side navigation, dies on reload) and the
 *    language lives in the URL. Zero cookies, zero storage of any kind —
 *    a visitor who has not accepted leaves no trace, exactly what the
 *    cookie bar promises.
 *
 *  - AFTER consent: persistent storage — localStorage for the theme and a
 *    1-year NEXT_LOCALE cookie for the language, so both survive browser
 *    restarts.
 *
 * This module must stay dependency-free: src/proxy.ts (edge middleware)
 * imports it and must not pull in the app's component graph.
 */

/** Set to "1" when the visitor accepts the cookie bar. Also read
 *  server-side in the locale layout so accepted visitors never see it. */
export const CONSENT_COOKIE = "pl_cookies";

/** Cookie src/proxy.ts reads to redirect unprefixed visits (`/`) to the
 *  remembered language. Written only after consent. next-intl's own
 *  cookie handling is disabled (localeCookie: false in the routing
 *  config), so this module is the single writer. */
export const LOCALE_COOKIE = "NEXT_LOCALE";

/** localStorage key for the persistent theme choice (post-consent).
 *  Re-exported by lib/shell.ts for the app's client components. */
export const THEME_KEY = "pl-theme";

/** How long accepted preferences persist: one year, in seconds. */
export const PREF_MAX_AGE = 31536000;

/** Theme remembered for the current visit only — memory tier, never
 *  written to any storage. Dies with the tab. */
let visitTheme: "dark" | "light" | null = null;

/** Whether the visitor has accepted the cookie bar. */
export function hasConsent(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie
    .split(";")
    .some((entry) => entry.trim().startsWith(`${CONSENT_COOKIE}=`));
}

/** Record acceptance. The consent itself must persist, otherwise the bar
 *  would reappear on every visit. */
export function acceptCookies(): void {
  document.cookie = `${CONSENT_COOKIE}=1; path=/; max-age=${PREF_MAX_AGE}; samesite=lax`;
}

/** Persist the language choice as a 1-year cookie. No-ops without
 *  consent. */
export function persistLocale(locale: string): void {
  if (!hasConsent()) return;
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${PREF_MAX_AGE}; samesite=lax`;
}

/** Record a theme choice. Before consent it stays in memory only (no
 *  storage write of any kind, not even sessionStorage — Chrome counts
 *  that as site data); after consent it also persists to localStorage. */
export function setThemeChoice(dark: boolean): void {
  visitTheme = dark ? "dark" : "light";
  if (hasConsent()) {
    try {
      localStorage.setItem(THEME_KEY, visitTheme);
    } catch { /* storage unavailable */ }
  }
}

/** The theme choice remembered for this visit (memory tier), or null if
 *  the visitor has not picked one this visit. */
export function getVisitTheme(): "dark" | "light" | null {
  return visitTheme;
}
