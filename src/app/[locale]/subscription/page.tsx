import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Crown } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getSubscriptionContent } from "@/lib/api";
import { SubscriptionBuilder, type SubFeature, type SubTier } from "@/components/SubscriptionBuilder";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "subscription" });
  return { title: t("title"), description: t("text") };
}

export default async function SubscriptionPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUser(locale, "/subscription");

  const t = await getTranslations({ locale, namespace: "subscription" });

  /* Tiers and the à-la-carte feature menu come from the Rust API
   * (subscription_tiers / subscription_features in Postgres); names are
   * message keys resolved here, prices are ₼/month. */
  const sub = (await getSubscriptionContent())!;
  const features: SubFeature[] = sub.features.map((f) => ({
    id: f.id, name: t(f.nameKey), price: f.price,
  }));

  const tiers: SubTier[] = sub.tiers.map((tier) => ({
    id: tier.id, name: t(tier.nameKey), price: tier.price, features: tier.features,
  }));

  const ui = {
    perMonth: t("perMonth"),
    templateTag: t("templateTag"),
    customTag: t("customTag"),
    customTitle: t("customTitle"),
    customDesc: t("customDesc"),
    total: t("total"),
    included: t("includedFree"),
    customCta: t("customCta"),
    tierCta: t("choose"),
    current: t("current"),
  };

  return (
    <div data-world="shell" className="world page">
      <div className="wrap">
        <header className="page-head">
          <p className="eyebrow"><i /><Crown size={14} aria-hidden />PreLife Premium</p>
          <h1 className="display sm">{t("title")}</h1>
          <p className="lede">{t("text")}</p>
        </header>

        <SubscriptionBuilder tiers={tiers} features={features} ui={ui} />

        <p className="stats-hint">{t("note")}</p>
      </div>
    </div>
  );
}
