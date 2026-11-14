import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { CONSENT_COOKIE, LOCALE_COOKIE } from "./lib/consent";

const handleI18nRouting = createMiddleware(routing);

/** Legacy welcome-tab slugs -> the unified section terms. Served as a
 *  301 (permanent, method-preserving for GET pages) for every locale. */
const LEGACY_WELCOME: Record<string, string> = {
  psychology: "meditation",
  books: "library",
};

/**
 * next-intl middleware with a pre-consent zero-storage guarantee.
 *
 * `localeCookie` is disabled in the routing config, so next-intl itself
 * never sets NEXT_LOCALE (neither here nor during client-side navigation)
 * — a fresh visitor accumulates no cookies at all until they accept the
 * cookie bar.
 *
 * For visitors who HAVE accepted, this wrapper restores the
 * remembered-language redirect for unprefixed paths (`/` -> `/az/...`)
 * that next-intl's disabled cookie detection would otherwise resolve via
 * the accept-language header.
 */
export default function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // 301: /welcome/psychology -> /welcome/meditation, /welcome/books ->
  // /welcome/library — in every locale (and unprefixed, where next-intl
  // would otherwise add the locale first).
  const legacyMatch = pathname.match(/^\/(?:([a-z]{2})\/)?welcome\/(psychology|books)\/?$/);
  if (legacyMatch) {
    const locale = legacyMatch[1] ?? routing.defaultLocale;
    const to = new URL(`/${locale}/welcome/${LEGACY_WELCOME[legacyMatch[2]]}`, request.url);
    return NextResponse.redirect(to, 301);
  }

  const hasLocalePrefix = routing.locales.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  );

  if (!hasLocalePrefix) {
    const consented = request.cookies.get(CONSENT_COOKIE)?.value === "1";
    const saved = request.cookies.get(LOCALE_COOKIE)?.value;
    if (consented && saved && (routing.locales as readonly string[]).includes(saved)) {
      const target = new URL(
        `/${saved}${pathname === "/" ? "" : pathname}${request.nextUrl.search}`,
        request.url,
      );
      return NextResponse.redirect(target);
    }
  }

  return handleI18nRouting(request);
}

export const config = {
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
