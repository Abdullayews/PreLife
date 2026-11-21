"use client";

import { useEffect } from "react";
import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { apiUrl } from "@/lib/api-url";
import { hasConsent, setThemeChoice, THEME_KEY } from "@/lib/consent";

/**
 * Account-tier preference sync (v3.2). For signed-in visitors the profiles
 * row is the source of truth: on mount we pull /api/me/preferences and
 *
 *  - apply the theme everywhere (mirrored into the local tier so the
 *    pre-paint bootstrap and ThemeGuard agree — post-consent into
 *    localStorage, pre-consent into the in-memory visit tier, keeping the
 *    zero-storage promise);
 *  - move to the account language once per visit, unless a ?next= login
 *    redirect is in flight (that flow must not be disturbed).
 *
 * Toggling saves to the account immediately (lib/user-prefs.ts), so after
 * the first apply the account and the browser never diverge.
 */
export function UserPrefsSync({ userId }: { userId: string | null }) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(apiUrl("/api/me/preferences"));
        if (!res.ok) return;
        const prefs = (await res.json()) as {
          locale?: string;
          theme?: string;
          reduceMotion?: boolean;
        };
        if (cancelled) return;

        if (prefs.theme === "dark" || prefs.theme === "light") {
          if (hasConsent()) {
            try { localStorage.setItem(THEME_KEY, prefs.theme); } catch { /* unavailable */ }
          } else {
            setThemeChoice(prefs.theme === "dark");
          }
          document.documentElement.classList.toggle("dark", prefs.theme === "dark");
        }

        // Account-tier reduce-motion (v3.5): follow the profile row across
        // devices — but only when this browser has no explicit local choice
        // yet (ThemeGuard keeps the local tier authoritative afterwards).
        if (typeof prefs.reduceMotion === "boolean") {
          let localMotion: string | null = null;
          try { localMotion = localStorage.getItem("pl-motion"); } catch { /* unavailable */ }
          if (localMotion === null) {
            document.documentElement.classList.toggle("reduce-motion", prefs.reduceMotion);
            if (hasConsent()) {
              try { localStorage.setItem("pl-motion", prefs.reduceMotion ? "off" : "on"); } catch { /* unavailable */ }
            }
          }
        }

        if (
          prefs.locale && prefs.locale !== locale &&
          !new URLSearchParams(window.location.search).has("next")
        ) {
          const key = "pl-prefs-locale";
          try {
            if (!sessionStorage.getItem(key)) {
              sessionStorage.setItem(key, "1");
              // Keep the current query (e.g. /verify?status=ok) — the
              // one-time language move must not drop it.
              router.replace(`${pathname}${window.location.search}`, { locale: prefs.locale });
            }
          } catch { /* sessionStorage unavailable — skip the one-time move */ }
        }
      } catch {
        /* offline — the local tiers keep working */
      }
    })();
    return () => { cancelled = true; };
  }, [userId, locale, router, pathname]);

  return null;
}
