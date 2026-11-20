import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";
import { apiGet } from "@/lib/server-api";

/**
 * The message catalog is DATABASE-DRIVEN: i18n_messages is read by the
 * RUST BACKEND (mini-services/prelife-api, /api/i18n — TTL-cached 60s
 * in-process there) and merged over the static messages/*.json files,
 * which stay in the repo as a build-time FALLBACK so the site still
 * renders if the backend is unreachable.
 */

type Catalog = Record<string, unknown>;

/** Fallback under, DB over: keys shipped in messages/*.json stay available
 *  even when the database catalog is older (e.g. a just-added error code),
 *  while every key the database has still wins. */
function deepMerge(base: Catalog, override: Catalog): Catalog {
  const out: Catalog = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const prev = out[key];
    out[key] =
      value && typeof value === "object" && !Array.isArray(value) &&
      prev && typeof prev === "object" && !Array.isArray(prev)
        ? deepMerge(prev as Catalog, value as Catalog)
        : value;
  }
  return out;
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  const fallback = (await import(`../../messages/${locale}.json`)).default as Catalog;

  let messages: Catalog = fallback;
  try {
    // 2.5 s budget: this runs on EVERY page render and the bundled catalog
    // below is the designed fallback — a hung backend must not add 20 s
    // of TTFB to every request.
    const fetched = await apiGet<Catalog>(`/api/i18n?locale=${locale}`, 2_500);
    if (fetched && typeof fetched === "object" && Object.keys(fetched).length > 0) {
      messages = deepMerge(fallback, fetched);
    }
  } catch {
    // Backend unreachable — keep the bundled catalog.
  }

  return { locale, messages };
});
