import type { Metadata } from "next";
import type { ReactNode } from "react";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { THEME_KEY } from "@/lib/shell";
import "../globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://prelife.net"),
  title: { default: "PreLife", template: "%s | PreLife" },
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/** First visit follows the OS; a saved manual choice always wins. Runs before paint. */
const themeScript = `try{var s=localStorage.getItem('${THEME_KEY}');if(s==='dark'||(!s&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;

export default async function LocaleLayout({
  children, params,
}: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  // Only the namespaces client components read are shipped to the browser.
  const all = await getMessages();
  const client = {
    moduleCommon: all.moduleCommon,
    welcomePage: all.welcomePage,
    sections: all.sections,
  };

  return (
    <html lang={locale} data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <NextIntlClientProvider messages={client}>
          <Nav />
          <main>{children}</main>
          <Footer />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
