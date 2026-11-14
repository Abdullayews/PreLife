import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

type Props = { params: Promise<{ locale: string; rest: string[] }> };

/**
 * Catch-all for every route under a valid locale that nothing else
 * matches — the "domain is right, but the route is not" case
 * (/en/xyz, /az/welcome/unknown, …).
 *
 * Without this file, unmatched URLs fall through to Next's built-in
 * ROOT not-found (which renders outside the locale layout, without nav,
 * footer or the intl provider). By matching here and calling
 * notFound(), the custom [locale]/not-found.tsx boundary renders
 * INSIDE the locale layout instead.
 */
export default async function CatchAllPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  notFound();
}
