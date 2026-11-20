import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getSessionUser, requireUser } from "@/lib/auth";
import { apiGet } from "@/lib/server-api";
import { getGymAppContent } from "@/lib/api";
import { ContentUnavailable } from "@/components/ContentUnavailable";
import { IdmanPage } from "@/components/idman/IdmanPage";
import { isIdmanTabId } from "@/components/idman/data";

/** { supabaseConfigured } from the Rust backend — cached 60s per process
 *  (the health endpoint answers it; the backend owns the DB config). */
let configuredCache: { at: number; v: boolean } | null = null;
async function backendConfigured(): Promise<boolean> {
  if (configuredCache && Date.now() - configuredCache.at < 60_000) {
    return configuredCache.v;
  }
  const cfg = await apiGet<{ supabaseConfigured: boolean }>("/internal/config");
  const v = cfg?.supabaseConfigured === true;
  configuredCache = { at: Date.now(), v };
  return v;
}

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
   * (fresh clone / offline demo) it falls back to a demo account so the
   * İdman surface still renders out of the box — in that case the guest
   * top Nav stays on screen, so the rail must keep its nav clearance. */
  const supabaseConfigured = await backendConfigured();
  const session = await getSessionUser();
  // The demo account carries the v3.4 session-user fields except
  // `location` — guests (supabase unconfigured, no session) see the
  // unfiltered, global catalog.
  const user = supabaseConfigured
    ? await requireUser(locale, sp.tab ? `/gym?tab=${encodeURIComponent(Array.isArray(sp.tab) ? sp.tab[0] : sp.tab)}` : "/gym")
    : session ?? {
      id: "demo", email: "demo@prelife.app", name: "Nigar", avatar: null,
      railFolded: false, role: "user" as const, psychSlug: null,
    };
  const topnav = !(supabaseConfigured ? user : session);

  /* The whole İdman surface renders from the DB catalog (gym_* content
   * tables, resolved into final locale strings server-side). When the
   * content backend is unreachable, degrade to the shared unavailable
   * shell — same as the other section pages. The demo fallback account
   * (supabase unconfigured, no session) has no location choice — guests
   * see the unfiltered catalog. */
  const catalog = await getGymAppContent(
    locale,
    "location" in user ? user.location : undefined,
  );
  if (!catalog || catalog.halls.length === 0) return <ContentUnavailable locale={locale} />;

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
          role: user.role ?? "user",
          psychSlug: user.psychSlug ?? null,
        }}
        catalog={catalog}
        initialTab={initialTab}
        tabs={[...tabs]}
        ui={{ label: r("label"), open: r("open"), close: r("close"), current: r("current"), title: s("gym.name") }}
        topnav={topnav}
      />
    </div>
  );
}
