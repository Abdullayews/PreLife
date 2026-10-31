import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft, Check, Crown } from "lucide-react";
import { Link } from "@/i18n/navigation";

type Props = { params: Promise<{ locale: string }> };
const PLANS = ["monthly", "yearly", "family"] as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "subscription" });
  return { title: t("title"), description: t("text") };
}

export default async function SubscriptionPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "subscription" });
  const ts = await getTranslations({ locale, namespace: "sections" });

  return (
    <div data-world="shell" className="world page">
      <div className="wrap">
        <Link href="/home" className="back"><ArrowLeft size={16} aria-hidden />{ts("backHome")}</Link>
        <header className="page-head center">
          <span className="chip-ico solid"><Crown size={22} aria-hidden /></span>
          <p className="eyebrow">{t("eyebrow")}</p>
          <h1 className="display sm">{t("title")}</h1>
          <p className="lede">{t("text")}</p>
        </header>

        <ul className="tiers">
          {PLANS.map((p) => {
            const featured = p === "yearly";
            return (
              <li key={p} className="tier" data-featured={featured ? "" : undefined}>
                {featured && <span className="tag tag-solid">{t("bestValue")}</span>}
                <h2 className="h3">{t(`plans.${p}.name`)}</h2>
                <p className="price">{t(`plans.${p}.price`)}</p>
                <p className="per">{t(`plans.${p}.per`)}</p>
                <p>{t(`plans.${p}.desc`)}</p>
                <ul className="checks">
                  {[1, 2, 3].map((n) => (
                    <li key={n}><Check size={16} aria-hidden />{t(`plans.${p}.features.${n}`)}</li>
                  ))}
                </ul>
                <button type="button" className={featured ? "btn" : "btn btn-ghost"} disabled aria-disabled="true">
                  {t("choose")}
                </button>
              </li>
            );
          })}
        </ul>
        <p className="note center">{t("note")}</p>
      </div>
    </div>
  );
}
