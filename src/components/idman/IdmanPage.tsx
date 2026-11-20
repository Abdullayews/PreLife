"use client";

import { useState } from "react";
import { AppShell, type ShellTab, type ShellUi } from "@/components/AppShell";
import { IdmanApp } from "./IdmanApp";
import { isIdmanTabId, type IdmanTabId } from "./data";
import type { GymAppContent } from "@/lib/gym";

/**
 * The PreLife wiring around the İdman surface: the GLOBAL left management
 * panel (AppShell) provides the rail — the İdman group (plan · qida
 * əlavələri · aksesuarlar · zallar · alətlər) nests under the Gym row as
 * its subtab group — while IdmanApp (embedded) renders only the main
 * column: the tab header and the five panels.
 *
 * Tab state lives here so the rail's tablist and the embedded panels stay
 * in sync; `?tab=` deep links pick the initial tab (plan is the default).
 * The gym content arrives as a server-resolved catalog prop (plain text,
 * final locale) and flows straight into IdmanApp.
 */
export function IdmanPage({
  user, catalog, initialTab, tabs, ui, topnav,
}: {
  user: { name: string; email: string; avatar?: string | null; railFolded?: boolean };
  /** Server-resolved gym catalog (lib/api.ts getGymAppContent). */
  catalog: GymAppContent;
  initialTab?: IdmanTabId;
  /** Pre-translated rail subtabs (labels from gymApp.tab_*, icon keys). */
  tabs: ShellTab[];
  ui: ShellUi;
  /** Whether the TOP nav renders for this visit (guests). */
  topnav?: boolean;
}) {
  const [tab, setTab] = useState<IdmanTabId>(initialTab ?? "plan");

  return (
    <AppShell
      mode="tab"
      tabs={tabs}
      activeId={tab}
      hrefs={{}}
      onSelect={(id) => { if (isIdmanTabId(id)) setTab(id); }}
      ui={ui}
      user={user}
      topnav={topnav}
    >
      <IdmanApp user={user} catalog={catalog} tab={tab} onTabChange={setTab} embedded />
    </AppShell>
  );
}
