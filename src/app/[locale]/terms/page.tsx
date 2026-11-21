import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getSessionUser } from "@/lib/auth";
import { AppPageShell } from "@/components/AppPageShell";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return { title: t("termsTitle") };
}

/** Terms of service — the v5.2 copy lives in messages/*.json (termsPage.placeholder). */
export default async function TermsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "termsPage" });

  /* v2.2: signed-in users have no top Nav, so they get the left
   * management rail around the page (the same shell /help uses);
   * guests keep the plain marketing layout. */
  const user = await getSessionUser();

  const body = (
    <div className="wrap">
      <header className="page-head">
        <p className="eyebrow"><i />PreLife</p>
        <h1 className="display sm">{t("title")}</h1>
      </header>
      <p className="legal-body">{t("placeholder")}</p>
    </div>
  );

  if (user) {
    return <AppPageShell locale={locale}>{body}</AppPageShell>;
  }

  return (
    <div data-world="shell" className="world page">{body}</div>
  );
}
