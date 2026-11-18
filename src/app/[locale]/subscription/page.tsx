import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Crown } from "lucide-react";
import { requireUser } from "@/lib/auth";
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

  /* The feature menu — everything the platform offers; ids are stable,
   * names/prices resolved here (prices in ₼/month). */
  const features: SubFeature[] = [
    { id: "gym", name: t("feat.gym"), price: 3 },
    { id: "diet", name: t("feat.diet"), price: 3 },
    { id: "psych", name: t("feat.psych"), price: 4 },
    { id: "library", name: t("feat.library"), price: 2 },
    { id: "ai", name: t("feat.ai"), price: 2 },
    { id: "videos", name: t("feat.videos"), price: 2 },
    { id: "coaching", name: t("feat.coaching"), price: 6 },
    { id: "family", name: t("feat.family"), price: 5 },
  ];

  const tiers: SubTier[] = [
    { id: "plus", name: t("plans.plus.name"), price: 7, features: ["gym", "diet", "ai"] },
    { id: "pro", name: t("plans.pro.name"), price: 12, features: ["gym", "diet", "psych", "library", "ai", "videos"] },
    { id: "ultra", name: t("plans.ultra.name"), price: 19, features: ["gym", "diet", "psych", "library", "ai", "videos", "coaching", "family"] },
  ];

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
