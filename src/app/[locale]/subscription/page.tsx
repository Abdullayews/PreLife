import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { UnderConstruction } from "@/components/UnderConstruction";
import { requireUser } from "@/lib/auth";

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

  return (
    <div data-world="shell" className="world page">
      <UnderConstruction locale={locale} />
    </div>
  );
}
