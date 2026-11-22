import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { HallConsole } from "@/components/gym/HallConsole";

type Props = { params: Promise<{ locale: string }> };

/**
 * The hall manager's own console (v5.4 role system) — where a linked
 * hall-manager account edits its partner hall's details (hours, day
 * price, address, welcome visibility) and manages the trainer roster.
 * Non-hall-manager accounts get a no-access notice instead.
 *
 * The rail mirrors the gym section: the Gym row becomes the group head
 * with the same five ?tab= deep links the İdman surface uses.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "gymApp" });
  return { title: t("console.title") };
}

export default async function HallConsolePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale, "/gym/console");

  const t = await getTranslations({ locale, namespace: "gymApp" });
  const r = await getTranslations({ locale, namespace: "sectionRail" });
  const s = await getTranslations({ locale, namespace: "sections" });

  /* The rail's İdman group — the same five tabs, as ?tab= deep links. */
  const tabs = [
    { id: "plan", label: t("tab_plan"), icon: "calendar", href: "/gym?tab=plan" },
    { id: "supplements", label: t("tab_supplements"), icon: "pill", href: "/gym?tab=supplements" },
    { id: "accessories", label: t("tab_accessories"), icon: "shirt", href: "/gym?tab=accessories" },
    { id: "gyms", label: t("tab_gyms"), icon: "mapPin", href: "/gym?tab=gyms" },
    { id: "equipment", label: t("tab_equipment"), icon: "dumbbell", href: "/gym?tab=equipment" },
  ] as const;

  const noAccess = (
    <div className="wrap">
      <header className="page-head">
        <h1 className="display sm">{t("console.title")}</h1>
      </header>
      <p className="lede">{t("console.noAccess")}</p>
    </div>
  );

  return (
    <div data-world="gym" className="world app-page">
      <AppShell
        mode="link"
        tabs={tabs.map(({ id, label, icon }) => ({ id, label, icon }))}
        activeId=""
        hrefs={Object.fromEntries(tabs.map(({ id, href }) => [id, href]))}
        user={{
          name: user.name,
          email: user.email,
          avatar: user.avatar ?? null,
          railFolded: user.railFolded ?? false,
          role: user.role,
          psychSlug: user.psychSlug ?? null,
          hallSlug: user.hallSlug ?? null,
        }}
        ui={{ label: r("label"), open: r("open"), close: r("close"), current: r("current"), title: s("gym.name") }}
      >
        {/* Only linked hall-manager accounts (role + slug on the session)
         * see the editor; everyone else gets the no-access notice. */}
        {user.role === "hall_manager" && user.hallSlug ? <HallConsole /> : noAccess}
      </AppShell>
    </div>
  );
}
