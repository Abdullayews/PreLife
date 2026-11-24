import type { ReactNode } from "react";
import type { Viewport } from "next";
import { Inter } from "next/font/google";
import { THEME_KEY } from "@/lib/shell";
import "./globals.css";

/* v6 (pro-site-craft): Inter — self-hosted via next/font (zero CLS,
 * automatic size-adjust, no external request at runtime). AZ coverage
 * verified against Google's latin-ext unicode-range (Ə U+018F, ə U+0259,
 * ş/Ş, ç/Ç, ğ/Ğ, İ/ı all present); cyrillic covers the RU locale. The
 * system stack stays as the fallback chain behind it. */
const inter = Inter({
  subsets: ["latin", "latin-ext", "cyrillic"],
  display: "swap",
  variable: "--font-inter",
});

/**
 * The true root layout — the ONLY place that renders <html>/<head>/<body>.
 *
 * Why it exists (sandbox↔Render parity): the pre-paint theme bootstrap used
 * to live in the [locale] layout, i.e. INSIDE the segment that re-renders on
 * every language switch. React 19's client renderer then re-created the
 * <script> element on some locale navigations, logging a dev-only console
 * error ("Encountered a script tag while rendering React component") which
 * raised the Next.js issues badge — floating chrome that never exists in
 * the production build on Render. Sitting ABOVE the [locale] segment, this
 * layout's fibers are never re-created by locale switches, so React keeps
 * the hydrated script node forever and the warning can no longer occur.
 *
 * <html lang> is resolved pre-paint by the same script (from the URL's
 * locale prefix) and kept in sync on soft navigations by <HtmlLang> in the
 * [locale] layout — the root layout has no locale param and must render
 * statically (reading headers()/cookies() here would force every page
 * dynamic and destroy the static rendering that makes Render fast).
 *
 * suppressHydrationWarning on <html>/<body> (attributes only, children
 * unaffected — the next-themes technique): the bootstrap script and the
 * preview wrapper add attributes (class="dark", lang, "vc-init") before
 * React hydrates; without the suppression React would report false-positive
 * attribute mismatches.
 */
const themeScript = `try{if(localStorage.getItem('${THEME_KEY}')==='dark')document.documentElement.classList.add('dark');if(localStorage.getItem('pl-motion')==='off')document.documentElement.classList.add('reduce-motion');var p=location.pathname.split('/')[1];if(p==='az'||p==='en'||p==='ru')document.documentElement.lang=p}catch(e){}`;

/* v4 mobile baseline: safe-area-aware viewport + per-scheme theme color
   matched to the page top (not the brand color). */
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0d0f" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // lang="en" is the static SSR default (the site's default locale); the
    // pre-paint script corrects it to az/ru from the URL prefix before the
    // first paint, and <HtmlLang> keeps it in sync on soft switches.
    <html lang="en" data-scroll-behavior="smooth" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
