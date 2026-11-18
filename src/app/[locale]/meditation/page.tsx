import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { UnderConstruction } from "@/components/UnderConstruction";
import { AppShell } from "@/components/AppShell";
import { requireUser } from "@/lib/auth";

type Props = {
  params: Promise<{ locale: string }>;
  /** ?tab=<planned subtab> — drives the rail's active tab. */
  searchParams: Promise<{ tab?: string | string[] }>;
};

/** The psychology section's planned subtabs — the rail structure ships
 *  now, the panels fill in as each part is built. */
const TABS = [
  { id: "programs", icon: "layers" },
  { id: "sessions", icon: "wind" },
  { id: "mentors", icon: "users" },
] as const;

const isTabId = (v: string): v is (typeof TABS)[number]["id"] =>
  TABS.some((t) => t.id === v);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meditationHome" });
  return { title: t("metaTitle"), description: t("metaDescription") };
}

export default async function MeditationPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  await requireUser(locale, "/meditation");

  const tabParam = Array.isArray(sp.tab) ? sp.tab[0] : sp.tab;
  const active = tabParam && isTabId(tabParam) ? tabParam : "programs";

  const t = await getTranslations({ locale, namespace: "meditationHome" });
  const r = await getTranslations({ locale, namespace: "sectionRail" });

  const tabs = TABS.map(({ id, icon }) => ({ id, label: t(`rail_${id}`), icon }));
  const hrefs = Object.fromEntries(
    TABS.map(({ id }) => [id, `/meditation?tab=${id}`]),
  );

  return (
    <div data-world="meditation" className="world app-page">
      <AppShell
        mode="link"
        tabs={tabs}
        activeId={active}
        hrefs={hrefs}
        ui={{ label: r("label"), open: r("open"), close: r("close"), current: r("current") }}
        storageKey="pl:rail:meditation"
      >
        <UnderConstruction locale={locale} />
      </AppShell>
    </div>
  );
}
