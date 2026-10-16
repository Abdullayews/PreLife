import {NextIntlClientProvider} from 'next-intl';
import {routing} from '../../i18n/routing';
import {notFound} from 'next/navigation';
import {setRequestLocale} from 'next-intl/server';

export default async function LocaleLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  if (!routing.locales.includes(locale)) notFound();
  setRequestLocale(locale);

  return (
    <NextIntlClientProvider>
      <html lang={locale}>
        <body>{children}</body>
      </html>
    </NextIntlClientProvider>
  );
}