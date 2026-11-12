import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { CONSENT_COOKIE, LOCALE_COOKIE } from "./lib/consent";

const handleI18nRouting = createMiddleware(routing);

/**
 * next-intl middleware with a pre-consent zero-cookie guarantee.
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
