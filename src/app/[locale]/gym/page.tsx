import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { WorldPage } from "@/components/WorldPage";
import { worlds } from "@/lib/worlds";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: worlds.gym.ns });
  return { title: t("metaTitle"), description: t("metaDescription") };
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <WorldPage slug="gym" locale={locale} />;
}
