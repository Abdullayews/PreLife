import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { UnderConstruction } from "@/components/UnderConstruction";
import { requireUser } from "@/lib/auth";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "gymHome" });
  return { title: t("metaTitle"), description: t("metaDescription") };
}

export default async function GymPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUser(locale, "/gym");

  return (
    <div data-world="gym" className="world page">
      <UnderConstruction locale={locale} />
    </div>
  );
}
