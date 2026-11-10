import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return { title: t("rulesTitle") };
}

/** Community rules — the real text arrives later; placeholder for now. */
export default async function RulesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "rulesPage" });

  return (
    <div data-world="shell" className="world page">
      <div className="wrap">
        <header className="page-head">
          <p className="eyebrow"><i />PreLife</p>
          <h1 className="display sm">{t("title")}</h1>
        </header>
        <p className="legal-body">{t("placeholder")}</p>
      </div>
    </div>
  );
}
