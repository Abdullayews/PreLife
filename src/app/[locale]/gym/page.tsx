import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getSessionUser, requireUser } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/server/supa";
import { IdmanPage } from "@/components/idman/IdmanPage";
import { isIdmanTabId } from "@/components/idman/data";

type Props = {
  params: Promise<{ locale: string }>;
  /** ?tab=<idman subtab> — shareable deep links (plan is the default). */
  searchParams: Promise<{ tab?: string | string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "gymApp" });
  return { title: t("metaTitle"), description: t("metaDescription") };
}

export default async function GymPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  /* With Supabase configured the page keeps its auth guard; without env
   * (fresh clone) the İdman surface still renders out of the box for
   * guests — in that case the guest top Nav stays on screen, so the rail
   * must keep its nav clearance. */
  const session = await getSessionUser();
  const user = supabaseConfigured
    ? await requireUser(locale, "/gym")
  const topnav = !(supabaseConfigured ? user : session);

  const tabParam = Array.isArray(sp.tab) ? sp.tab[0] : sp.tab;
  const initialTab = tabParam && isIdmanTabId(tabParam) ? tabParam : undefined;

  const t = await getTranslations({ locale, namespace: "gymApp" });
  const r = await getTranslations({ locale, namespace: "sectionRail" });
  const s = await getTranslations({ locale, namespace: "sections" });

  /* The rail's İdman group — the same five tabs, translated labels,
   * registry icons resolved inside the AppShell. */
  const tabs = [
    { id: "plan", label: t("tab_plan"), icon: "calendar" },
    { id: "supplements", label: t("tab_supplements"), icon: "pill" },
    { id: "accessories", label: t("tab_accessories"), icon: "shirt" },
    { id: "gyms", label: t("tab_gyms"), icon: "mapPin" },
    { id: "equipment", label: t("tab_equipment"), icon: "dumbbell" },
  ] as const;

  return (
    <div data-world="gym" className="world app-page">
      <IdmanPage
        user={{
          name: user.name ?? user.email,
          email: user.email,
          avatar: user.avatar ?? null,
          railFolded: user.railFolded ?? false,
        }}
        initialTab={initialTab}
        tabs={[...tabs]}
        ui={{ label: r("label"), open: r("open"), close: r("close"), current: r("current"), title: s("gym.name") }}
        topnav={topnav}
      />
    </div>
  );
}
