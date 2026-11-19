import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { getSessionUser } from "@/lib/auth";

/**
 * The psychology section's shell: the shared left rail (link mode — each
 * tab is one of the section's real routes) around whatever the active
 * subpage renders. Every /meditation* page wraps its content in this,
 * passing its own tab id, so the rail follows the visitor across
 * subpages.
 *
 * Labels resolve server-side from psychApp.rail_*; the rail UI strings
 * (open/close/current) come from the shared sectionRail namespace.
 */

const TABS = [
  { id: "overview", href: "/meditation", icon: "house" },
  { id: "psychologists", href: "/meditation/psychologists", icon: "brain" },
  { id: "bookings", href: "/meditation/bookings", icon: "calendar" },
  { id: "mood", href: "/meditation/mood", icon: "flower" },
  { id: "journal", href: "/meditation/journal", icon: "notebook" },
  { id: "practice", href: "/meditation/practice", icon: "audio" },
  { id: "tdb", href: "/meditation/tdb", icon: "video" },
] as const;

export async function PsychShell({
  locale, active, children,
}: { locale: string; active: string; children: ReactNode }) {
  const t = await getTranslations({ locale, namespace: "psychApp" });
  const r = await getTranslations({ locale, namespace: "sectionRail" });
  const s = await getTranslations({ locale, namespace: "sections" });
  const user = await getSessionUser();

  const tabs = TABS.map(({ id, icon }) => ({ id, label: t(`rail_${id}`), icon }));
  const hrefs = Object.fromEntries(TABS.map(({ id, href }) => [id, href]));

  return (
    <div data-world="meditation" className="world app-page">
      <AppShell
        mode="link"
        tabs={tabs}
        activeId={active}
        hrefs={hrefs}
        user={user ? {
          name: user.name,
          email: user.email,
          avatar: user.avatar ?? null,
          railFolded: user.railFolded ?? false,
        } : null}
        ui={{ label: r("label"), open: r("open"), close: r("close"), current: r("current"), title: s("meditation.name") }}
      >
        {children}
      </AppShell>
    </div>
  );
}
