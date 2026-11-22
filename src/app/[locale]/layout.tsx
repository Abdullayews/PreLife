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
import { UserPrefsSync } from "@/components/UserPrefsSync";
import { SwRegister } from "@/components/SwRegister";
import { ConnectionNotice } from "@/components/ConnectionNotice";
import { HtmlLang } from "@/components/HtmlLang";
import { AiChatFab } from "@/components/AiChatFab";
import { Toaster } from "@/components/Toaster";
import { getSessionUser } from "@/lib/auth";
import { CONSENT_COOKIE } from "@/lib/consent";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://prelife.onrender.com"),
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
    sidePanel: all.sidePanel,
    cookieBar: all.cookieBar,
    settingsPage: all.settingsPage,
    notFoundPage: all.notFoundPage,
    connection: all.connection,
    psychApp: all.psychApp,
    dietApp: all.dietApp,
    gymApp: all.gymApp,
    gymHome: all.gymHome,
    adminApp: all.adminApp,
    libraryApp: all.libraryApp,
    libraryHome: all.libraryHome,
    subscription: all.subscription,
    aiChat: all.aiChat,
    profilePage: all.profilePage,
    verifyPage: all.verifyPage,
  };

  return (
    <>
      <HtmlLang locale={locale} />
      <NextIntlClientProvider messages={client}>
        {/* v2.3: the top bar renders for everyone — guests on every
            surface, signed-in users on the welcome surface. On the app
            surface a signed-in visitor navigates via the İdman rail
            (AppShell), so Nav hides itself there (it owns the pathname
            check — see Nav.tsx). */}
        <Nav user={user ? { name: user.name, email: user.email } : null} />
        <ThemeGuard />
        <UserPrefsSync userId={user?.id ?? null} />
        <SwRegister />
        <ConnectionNotice />
        {/* v4: the global action-feedback layer — toast() from any client
            component lands here (profile saves, package requests,
            bookings, mood check-ins). */}
        <Toaster />
        {/* v6.1: the AI assistant follows the signed-in user EVERYWHERE —
            every tab and subtab renders the floating chat (context-aware,
            account tools enabled). Guests meet it on /welcome. */}
        {user && <AiChatFab signedIn />}
        <main>{children}</main>
        <Footer />
        <CookieConsent initialAccepted={cookieStore.get(CONSENT_COOKIE)?.value === "1"} />
      </NextIntlClientProvider>
    </>
  );
}
