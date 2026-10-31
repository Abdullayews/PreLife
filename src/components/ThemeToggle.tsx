"use client";

import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { THEME_KEY } from "@/lib/shell";

export function ThemeToggle() {
  const t = useTranslations("moduleCommon");
  return (
    <button
      type="button"
      className="icon-btn"
      aria-label={t("navThemeToggle")}
      title={t("navThemeToggle")}
      onClick={() => {
        const dark = document.documentElement.classList.toggle("dark");
        try { localStorage.setItem(THEME_KEY, dark ? "dark" : "light"); } catch { /* storage unavailable */ }
      }}
    >
      <Sun aria-hidden className="ico-sun" size={18} />
      <Moon aria-hidden className="ico-moon" size={18} />
    </button>
  );
}
