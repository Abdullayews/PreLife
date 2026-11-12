/**
 * Cookie-consent state and preference persistence.
 *
 * Visitor preferences (theme, locale) are stored in two tiers:
 *
 *  - BEFORE consent: visit-scoped storage only — sessionStorage for the
 *    theme and the session cookie next-intl writes for the locale. Nothing
 *    survives a browser restart.
 *
 *  - AFTER consent: persistent storage — localStorage for the theme and a
 *    1-year NEXT_LOCALE cookie for the language, so both survive restarts.
 *
 * Safe to import from server components: `document` is only touched inside
 * function bodies, never at module scope.
 */

/** Set to "1" when the visitor accepts the cookie bar. Also read
 * server-side in the locale layout so accepted visitors never see it. */
export const CONSENT_COOKIE = "pl_cookies";

/** Cookie the next-intl middleware reads to detect the visitor's language
 * when routing `/` and unprefixed paths. */
export const LOCALE_COOKIE = "NEXT_LOCALE";

/** How long accepted preferences persist: one year, in seconds. */
export const PREF_MAX_AGE = 31536000;

/** Whether the visitor has accepted the cookie bar. */
export function hasConsent(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie
    .split(";")
    .some((entry) => entry.trim().startsWith(`${CONSENT_COOKIE}=`));
}

/** Record acceptance. The consent itself must persist, otherwise the bar
 * would reappear on every visit. */
export function acceptCookies(): void {
  document.cookie = `${CONSENT_COOKIE}=1; path=/; max-age=${PREF_MAX_AGE}; samesite=lax`;
}

/** Persist the language choice as a 1-year cookie, read by src/proxy.ts
 *  to redirect unprefixed visits to the remembered language. next-intl's
 *  own cookie handling is disabled (localeCookie: false in the routing
 *  config) so that nothing is stored before consent — this is the only
 *  writer. No-ops without consent. */
export function persistLocale(locale: string): void {
  if (!hasConsent()) return;
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${PREF_MAX_AGE}; samesite=lax`;
}
