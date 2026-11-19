"use client";

import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { setThemeChoice } from "@/lib/consent";
import { saveUserPref } from "@/lib/user-prefs";

export function ThemeToggle({ signedIn = false }: { signedIn?: boolean }) {
  const t = useTranslations("moduleCommon");
  return (
    <button
      type="button"
      className="icon-btn"
      aria-label={t("navThemeToggle")}
      title={t("navThemeToggle")}
      onClick={() => {
        const dark = document.documentElement.classList.toggle("dark");
        // Guest tiers: after cookie consent the choice persists
        // (localStorage); before consent it lives in memory for this visit
        // only — no storage is written at all.
        setThemeChoice(dark);
        // Account tier (v3.2): signed-in users also save the choice to
        // their profiles row, so it follows them across devices.
        if (signedIn) saveUserPref({ theme: dark ? "dark" : "light" });
      }}
    >
      <Sun aria-hidden className="ico-sun" size={18} />
      <Moon aria-hidden className="ico-moon" size={18} />
    </button>
  );
}
