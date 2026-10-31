"use client";

import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * Dark / light mode toggle. Hydration-safe: both icons render server-side
 * and globals.css shows exactly one per mode (html.dark selectors), so
 * there is never a client/server mismatch. Persisted in localStorage under
 * "pl-theme"; a tiny inline script in the root layout applies the saved
 * choice before first paint (no flash).
 */
export function ThemeToggle() {
  const t = useTranslations("moduleCommon");

  const toggle = () => {
    const root = document.documentElement;
    const dark = root.classList.toggle("dark");
    try {
      localStorage.setItem("pl-theme", dark ? "dark" : "light");
    } catch {
      /* private mode - ignore */
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t("navThemeToggle")}
      title={t("navThemeToggle")}
      className="inline-flex size-10 items-center justify-center rounded-full border transition-colors hover:bg-[var(--nav-glass-hover)]"
      style={{
        borderColor: "var(--nav-glass-line)",
        color: "var(--nav-glass-ink)",
      }}
    >
      <Sun aria-hidden className="pl-icon-sun size-[18px]" />
      <Moon aria-hidden className="pl-icon-moon size-[18px]" />
    </button>
  );
}
