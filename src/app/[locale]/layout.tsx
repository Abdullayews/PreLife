import type { Metadata } from "next";
import type { ReactNode } from "react";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { routing } from "@/i18n/routing";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { CookieConsent } from "@/components/CookieConsent";
import { ThemeGuard } from "@/components/ThemeGuard";
import { getSessionUser } from "@/lib/auth";
import { THEME_KEY } from "@/lib/shell";
import { CONSENT_COOKIE } from "@/lib/consent";
import "../globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://prelife.net"),
  title: { default: "PreLife", template: "%s | PreLife" },
  icons: { icon: "/logo.svg" },
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/** White is the default; only an explicit saved "dark" choice applies dark
 *  mode. Runs before paint. localStorage is written only after cookie
 *  consent — before consent the theme lives in memory for the visit. */
const themeScript = `try{if(localStorage.getItem('${THEME_KEY}')==='dark')document.documentElement.classList.add('dark')}catch(e){}`;

export default async function LocaleLayout({
  children, params,
}: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const [user, cookieStore, all] = await Promise.all([getSessionUser(), cookies(), getMessages()]);

  // Only the namespaces client components read are shipped to the browser.
  const client = {
    moduleCommon: all.moduleCommon,
    welcomePage: all.welcomePage,
    sections: all.sections,
    authPage: all.authPage,
    accountMenu: all.accountMenu,
    cookieBar: all.cookieBar,
    settingsPage: all.settingsPage,
  };

  return (
    <html lang={locale} data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <NextIntlClientProvider messages={client}>
          <Nav user={user ? { name: user.name, email: user.email } : null} />
          <ThemeGuard />
          <main>{children}</main>
          <Footer />
          <CookieConsent initialAccepted={cookieStore.get(CONSENT_COOKIE)?.value === "1"} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
