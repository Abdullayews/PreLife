import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { getSessionUser } from "@/lib/auth";

/**
 * The nutrition section's shell: the shared left rail (link mode — each
 * tab is one of the section's real routes) around whatever the active
 * subpage renders. Every /diet* page wraps its content in this, passing
 * its own tab id, so the rail follows the visitor across subpages.
 *
 * Labels resolve server-side from dietApp.rail_*; the rail UI strings
 * (open/close/current) come from the shared sectionRail namespace.
 */

const TABS = [
  { id: "overview", href: "/diet", icon: "house" },
  { id: "plans", href: "/diet/plans", icon: "calendar" },
  { id: "recipes", href: "/diet/recipes", icon: "chef" },
  { id: "places", href: "/diet/places", icon: "mapPin" },
] as const;

export async function DietShell({
  locale, active, children,
}: { locale: string; active: string; children: ReactNode }) {
  const t = await getTranslations({ locale, namespace: "dietApp" });
  const r = await getTranslations({ locale, namespace: "sectionRail" });
  const s = await getTranslations({ locale, namespace: "sections" });
  const user = await getSessionUser();

  const tabs = TABS.map(({ id, icon }) => ({ id, label: t(`rail_${id}`), icon }));
  const hrefs = Object.fromEntries(TABS.map(({ id, href }) => [id, href]));

  return (
    <div data-world="diet" className="world app-page">
      <AppShell
        mode="link"
        tabs={tabs}
        activeId={active}
        hrefs={hrefs}
        user={user ? { name: user.name, email: user.email } : null}
        ui={{ label: r("label"), open: r("open"), close: r("close"), current: r("current"), title: s("diet.name") }}
        storageKey="pl:rail:diet"
      >
        {children}
      </AppShell>
    </div>
  );
}
