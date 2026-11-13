"use client";

import { useEffect } from "react";
import { THEME_KEY, getVisitTheme } from "@/lib/consent";

/**
 * Keeps the dark-mode class on <html> alive across React re-renders.
 *
 * The theme is applied imperatively (pre-paint script in the layout +
 * ThemeToggle clicks), but React 19 wipes unknown classes from <html>
 * whenever the root element re-renders — most visibly when the language
 * switches (the <html lang> attribute changes), which silently dropped
 * dark mode until the next full page load. The same technique next-themes
 * uses: watch the class list and restore the chosen value.
 *
 * Resolution order: the persistent tier (localStorage, written only
 * after cookie consent) wins; otherwise the in-memory visit theme
 * (pre-consent); otherwise leave the class untouched.
 */
export function ThemeGuard() {
  useEffect(() => {
    const restore = () => {
      let stored: string | null = null;
      try {
        stored = localStorage.getItem(THEME_KEY);
      } catch { /* storage unavailable — fall back to the memory tier */ }
      const remembered = stored ?? getVisitTheme();
      if (remembered !== null) {
        const dark = remembered === "dark";
        if (document.documentElement.classList.contains("dark") !== dark) {
          document.documentElement.classList.toggle("dark", dark);
        }
      }
    };

    restore();
    const observer = new MutationObserver(restore);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  return null;
}
