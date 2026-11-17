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
import { SwRegister } from "@/components/SwRegister";
import { ConnectionNotice } from "@/components/ConnectionNotice";
import { HtmlLang } from "@/components/HtmlLang";
import { getSessionUser } from "@/lib/auth";
import { CONSENT_COOKIE } from "@/lib/consent";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://prelife.net"),
  title: { default: "PreLife", template: "%s | PreLife" },
  icons: { icon: "/logo.svg" },
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/**
 * The per-locale layout: a fragment below the true root layout
 * (src/app/layout.tsx — see the notes there for why <html> moved up).
 * Everything that needs the locale or per-request data renders here;
 * <HtmlLang> mirrors the active locale onto <html lang> after hydration
 * and on every soft language switch.
 */
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
    notFoundPage: all.notFoundPage,
    connection: all.connection,
    dietApp: all.dietApp,
  };

  return (
    <>
      <HtmlLang locale={locale} />
      <NextIntlClientProvider messages={client}>
        <Nav user={user ? { name: user.name, email: user.email } : null} />
        <ThemeGuard />
        <SwRegister />
        <ConnectionNotice />
        <main>{children}</main>
        <Footer />
        <CookieConsent initialAccepted={cookieStore.get(CONSENT_COOKIE)?.value === "1"} />
      </NextIntlClientProvider>
    </>
  );
}
