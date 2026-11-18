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

/** The library section's planned subtabs — the rail structure ships
 *  now, the panels fill in as each part is built. */
const TABS = [
  { id: "collections", icon: "library" },
  { id: "books", icon: "book" },
  { id: "venues", icon: "landmark" },
] as const;

const isTabId = (v: string): v is (typeof TABS)[number]["id"] =>
  TABS.some((t) => t.id === v);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "libraryHome" });
  return { title: t("metaTitle"), description: t("metaDescription") };
}

export default async function LibraryPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  await requireUser(locale, "/library");

  const tabParam = Array.isArray(sp.tab) ? sp.tab[0] : sp.tab;
  const active = tabParam && isTabId(tabParam) ? tabParam : "collections";

  const t = await getTranslations({ locale, namespace: "libraryHome" });
  const r = await getTranslations({ locale, namespace: "sectionRail" });

  const tabs = TABS.map(({ id, icon }) => ({ id, label: t(`rail_${id}`), icon }));
  const hrefs = Object.fromEntries(
    TABS.map(({ id }) => [id, `/library?tab=${id}`]),
  );

  return (
    <div data-world="library" className="world app-page">
      <AppShell
        mode="link"
        tabs={tabs}
        activeId={active}
        hrefs={hrefs}
        ui={{ label: r("label"), open: r("open"), close: r("close"), current: r("current") }}
        storageKey="pl:rail:library"
      >
        <UnderConstruction locale={locale} />
      </AppShell>
    </div>
  );
}
