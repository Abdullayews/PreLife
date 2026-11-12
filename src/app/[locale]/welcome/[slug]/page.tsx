import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { worlds, type WorldSlug } from "@/lib/worlds";
import { sections } from "@/lib/shell";
import { WorldPage } from "@/components/WorldPage";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

/** Public tab address -> content world (psychology -> meditation, books -> library). */
const worldByWelcomeSlug = (slug: string): WorldSlug | undefined =>
  sections.find((s) => s.welcomeSlug === slug)?.slug;

export function generateStaticParams() {
  return sections.map((s) => ({ slug: s.welcomeSlug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const world = worldByWelcomeSlug(slug);
  if (!world) return {};
  const t = await getTranslations({ locale, namespace: worlds[world].ns });
  return { title: t("metaTitle"), description: t("metaDescription") };
}

/**
 * The PUBLIC marketing page for one section — /welcome/gym, /welcome/diet,
 * /welcome/psychology, /welcome/books. Open to every visitor: the welcome
 * tabs point here. The registered-user app pages live at /gym, /diet,
 * /meditation, /library instead (behind auth, content to be written later).
 *
 * The old world-slug addresses /welcome/meditation and /welcome/library
 * redirect permanently to the tab-name addresses.
 */
export default async function WelcomeWorldPage({ params }: Props) {
  const { locale, slug } = await params;

  const legacy = sections.find((s) => s.slug === slug && s.welcomeSlug !== slug);
  if (legacy) permanentRedirect(`/${locale}/welcome/${legacy.welcomeSlug}`);

  const world = worldByWelcomeSlug(slug);
  if (!world) notFound();

  setRequestLocale(locale);
  return <WorldPage slug={world} locale={locale} />;
}
