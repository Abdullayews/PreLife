"use client";

import { useEffect } from "react";

/**
 * Keeps <html lang> in sync with the active locale.
 *
 * The root layout renders <html> but has no locale param (it sits above the
 * [locale] segment), so the language reaches the document element from
 * here: once after hydration (belt-and-braces on top of the pre-paint
 * script in the root layout, which parses the URL prefix) and again on
 * every soft locale switch. Screen readers therefore always get the right
 * pronunciation for the page they are actually reading.
 */
export function HtmlLang({ locale }: { locale: string }) {
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return null;
}
