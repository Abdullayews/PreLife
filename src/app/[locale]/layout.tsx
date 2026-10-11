import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { SiteNav } from "@/components/site-nav";
import { WelcomeFooter } from "@/components/welcome/footer";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://prelife.net"
  ),
  title: {
    default: "PreLife",
    template: "%s | PreLife",
  },
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="flex min-h-svh flex-col bg-background font-sans text-foreground antialiased">
        {/* Dark / light mode: apply the saved choice before first paint. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(localStorage.getItem('pl-theme')==='dark'){document.documentElement.classList.add('dark');}}catch(e){}",
          }}
        />
        {/* Display typeface shared by the site nav and every module hero
            (runtime link, graceful fallback - never blocks build) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- App
            Router root layout: this link is global, not per-page */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800;900&display=swap"
        />
        <NextIntlClientProvider>
          <SiteNav />
          <main className="flex flex-1 flex-col">{children}</main>
          <WelcomeFooter />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
