import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ModulePlaceholder } from "@/components/module-placeholder";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return { title: t("meditation") };
}

export default async function MeditationPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const tNav = await getTranslations({ locale, namespace: "nav" });
  const tModules = await getTranslations({ locale, namespace: "modules" });

  return (
    <ModulePlaceholder
      title={tNav("meditation")}
      description={tModules("meditation")}
    />
  );
}
