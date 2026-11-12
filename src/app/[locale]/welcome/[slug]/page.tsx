import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { worlds, worldSlugs, type WorldSlug } from "@/lib/worlds";
import { WorldPage } from "@/components/WorldPage";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export function generateStaticParams() {
  return worldSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!worlds[slug as WorldSlug]) return {};
  const t = await getTranslations({ locale, namespace: worlds[slug as WorldSlug].ns });
  return { title: t("metaTitle"), description: t("metaDescription") };
}

/**
 * The PUBLIC marketing page for one section — /welcome/gym, /welcome/diet,
 * /welcome/meditation, /welcome/library. Open to every visitor: the welcome
 * tabs point here. The registered-user app pages live at /<slug> instead.
 */
export default async function WelcomeWorldPage({ params }: Props) {
  const { locale, slug } = await params;
  if (!worlds[slug as WorldSlug]) notFound();
  setRequestLocale(locale);
  return <WorldPage slug={slug as WorldSlug} locale={locale} />;
}
