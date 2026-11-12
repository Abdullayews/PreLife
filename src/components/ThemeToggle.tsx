"use client";

import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { setThemeChoice } from "@/lib/consent";

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
        // After cookie consent the choice persists (localStorage);
        // before consent it lives in memory for this visit only — no
        // storage is written at all.
        setThemeChoice(dark);
      }}
    >
      <Sun aria-hidden className="ico-sun" size={18} />
      <Moon aria-hidden className="ico-moon" size={18} />
    </button>
  );
}
