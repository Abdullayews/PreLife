import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { getSessionUser } from "@/lib/auth";

/**
 * The shell for app pages that are NOT a section — /home, /settings,
 * /profile, /subscription, /help. It runs the same left management
 * panel the section pages use (identity · main nav · management ·
 * preferences · log out), just without a subtab group: the panel's
 * main navigation IS the page's navigation.
 *
 * Guests (a /help visit without an account) get the navigation-only
 * variant — identity/management/prefs stay signed-in-only.
 */
export async function AppPageShell({
  locale, children,
}: { locale: string; children: ReactNode }) {
  const [user, r] = await Promise.all([
    getSessionUser(),
    getTranslations({ locale, namespace: "sectionRail" }),
  ]);

  return (
    <div data-world="shell" className="world app-page">
      <AppShell
        mode="link"
        tabs={[]}
        activeId=""
        hrefs={{}}
        user={user ? {
          name: user.name,
          email: user.email,
          avatar: user.avatar ?? null,
          railFolded: user.railFolded ?? false,
          role: user.role ?? "user",
          psychSlug: user.psychSlug ?? null,
        } : null}
        ui={{ label: r("label"), open: r("open"), close: r("close"), current: r("current") }}
      >
        {children}
      </AppShell>
    </div>
  );
}
