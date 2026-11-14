import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { worlds, type WorldSlug } from "@/lib/worlds";
import { sections, type WelcomeSlug } from "@/lib/shell";
import { WorldPage } from "@/components/WorldPage";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

/** Public tab address -> content world (one term per section).
 *  The OLD tab names — /welcome/psychology and /welcome/books — are
 *  permanently redirected (301) to the unified slugs in src/proxy.ts;
 *  the redirect below is the render-path fallback. */
const worldByWelcomeSlug = (slug: string): WorldSlug | undefined =>
  sections.find((s) => s.welcomeSlug === slug)?.slug;

/** Legacy tab-name slug -> the unified slug (psychology -> meditation,
 *  books -> library). Kept so old shared links keep working. */
const LEGACY_WELCOME: Record<string, WelcomeSlug> = {
  psychology: "meditation",
  books: "library",
};

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
 * /welcome/meditation, /welcome/library. Open to every visitor: the welcome
 * tabs point here. The registered-user app pages live at /gym, /diet,
 * /meditation, /library instead (behind auth, content to be written later).
 *
 * The old tab-name addresses /welcome/psychology and /welcome/books
 * redirect permanently to the unified slugs.
 */
export default async function WelcomeWorldPage({ params }: Props) {
  const { locale, slug } = await params;

  const legacy = LEGACY_WELCOME[slug];
  if (legacy) permanentRedirect(`/${locale}/welcome/${legacy}`);

  const world = worldByWelcomeSlug(slug);
  if (!world) notFound();

  setRequestLocale(locale);
  return <WorldPage slug={world} locale={locale} />;
}
