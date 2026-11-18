import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

/**
 * The message catalog is DATABASE-DRIVEN: it is loaded from the Rust
 * backend, which reads i18n_messages from Supabase Postgres (one row per
 * dotted key, three locale columns). The static messages/*.json files stay
 * in the repo as a build-time FALLBACK so the site still renders if the
 * API is unreachable.
 */
const API_BASE = process.env.PRELIFE_API_URL ?? "http://127.0.0.1:3031";

type Catalog = Record<string, unknown>;

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  const fallback = (await import(`../../messages/${locale}.json`)).default as Catalog;

  let messages: Catalog = fallback;
  try {
    const res = await fetch(`${API_BASE}/api/i18n?locale=${locale}`, {
      next: { revalidate: 300 },
    });
    if (res.ok) {
      const fetched = (await res.json()) as Catalog;
      if (fetched && typeof fetched === "object" && Object.keys(fetched).length > 0) {
        messages = fetched;
      }
    }
  } catch {
    // API unreachable — keep the bundled catalog.
  }

  return { locale, messages };
});
