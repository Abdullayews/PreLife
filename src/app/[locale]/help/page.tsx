import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ChevronDown, Mail } from "lucide-react";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return { title: t("helpTitle") };
}

/** Help — public FAQ + contact note. Open to everyone, linked from the
 *  account dropdown. */
export default async function HelpPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "helpPage" });
  const faqs = ["q1", "q2", "q3", "q4"] as const;

  return (
    <div data-world="shell" className="world page">
      <div className="wrap">
        <header className="page-head">
          <p className="eyebrow"><i />{t("eyebrow")}</p>
          <h1 className="display sm">{t("title")}</h1>
          <p className="lede">{t("subtitle")}</p>
        </header>

        <section className="blk" aria-labelledby="faq-title">
          <h2 id="faq-title" className="eyebrow">{t("faqTitle")}</h2>
          <div className="faq-list">
            {faqs.map((key) => (
              <details key={key} className="faq">
                <summary>
                  {t(`faq.${key}`)}
                  <ChevronDown size={16} aria-hidden />
                </summary>
                <p>{t(`faq.a${key.slice(1)}`)}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="blk">
          <div className="banner">
            <span className="chip-ico solid"><Mail size={20} aria-hidden /></span>
            <div>
              <h2 className="h3">{t("contactTitle")}</h2>
              <p>{t("contactText")}</p>
            </div>
            <a href="mailto:hello@prelife.net" className="btn">{t("contactCta")}</a>
          </div>
        </section>
      </div>
    </div>
  );
}
