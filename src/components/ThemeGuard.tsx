"use client";

import { useEffect } from "react";
import { THEME_KEY } from "@/lib/shell";

/**
 * Keeps the dark-mode class on <html> alive across React re-renders.
 *
 * The theme is applied imperatively (pre-paint script in the layout +
 * ThemeToggle clicks), but React 19 wipes unknown classes from <html>
 * whenever the root element re-renders — most visibly when the language
 * switches (the <html lang> attribute changes), which silently dropped
 * dark mode until the next full page load. The same technique next-themes
 * uses: watch the class list and restore the stored choice.
 *
 * Never fights the toggle: on click, the class and the stored value are
 * updated together, so the observer always reads back a consistent state.
 */
export function ThemeGuard() {
  useEffect(() => {
    const restore = () => {
      let stored: string | null = null;
      try {
        stored = localStorage.getItem(THEME_KEY) || sessionStorage.getItem(THEME_KEY);
      } catch { /* storage unavailable — leave the class as-is */ }
      const dark = stored === "dark";
      if (document.documentElement.classList.contains("dark") !== dark) {
        document.documentElement.classList.toggle("dark", dark);
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
