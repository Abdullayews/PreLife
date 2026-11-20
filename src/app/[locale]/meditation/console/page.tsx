import type { Metadata } from "next";
import { getMessages, setRequestLocale } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { PsychShell } from "@/components/psych/PsychShell";
import { ConsolePanel, type ConsoleCopy } from "@/components/psych/ConsolePanel";

type Props = { params: Promise<{ locale: string }> };

/**
 * The psychologist's own console (v3.4 request workflow) — where a linked
 * psychologist account confirms or declines the session requests clients
 * sent from the psychologists page. Non-psychologist accounts get a
 * no-access notice instead.
 *
 * The psychApp.console.* strings ship in messages/*.json under a literal
 * flat "psychApp.console" key (and as dotted rows in the DB catalog, which
 * next-intl rebuilds nested) — next-intl itself cannot traverse the flat
 * key as a namespace, so the copy is resolved here (nested tree first,
 * flat literal as the fallback) and passed into the panel as plain
 * strings. Both shapes stay available after the DB catalog sync, so this
 * keeps working either way.
 */
async function consoleCopy(locale: string): Promise<ConsoleCopy> {
  const messages = (await getMessages({ locale })) as Record<string, unknown>;
  const psy = messages.psychApp as Record<string, unknown> | undefined;
  const nested = psy?.console as Record<string, unknown> | undefined;
  const flat = messages["psychApp.console"] as Record<string, unknown> | undefined;
  const tree = nested && typeof nested.title === "string" ? nested : flat;
  const s = (key: string): string => {
    const v = tree?.[key];
    return typeof v === "string" && v ? v : "";
  };
  return {
    title: s("title"),
    subtitle: s("subtitle"),
    pendingTitle: s("pendingTitle"),
    empty: s("empty"),
    client: s("client"),
    wants: s("wants"),
    when: s("when"),
    mode: s("mode"),
    confirm: s("confirm"),
    decline: s("decline"),
    confirmedTitle: s("confirmedTitle"),
    confirmedEmpty: s("confirmedEmpty"),
    custom: s("custom"),
    noAccess: s("noAccess"),
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const copy = await consoleCopy(locale);
  return { title: copy.title || "PreLife" };
}

export default async function ConsolePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale, "/meditation/console");
  const copy = await consoleCopy(locale);

  // Only linked psychologist accounts (role + slug on the session) see the
  // queues; everyone else gets the no-access notice.
  if (user.role !== "psychologist" || !user.psychSlug) {
    return (
      <PsychShell locale={locale} active="console">
        <div className="wrap">
          <header className="page-head">
            <h1 className="display sm">{copy.title}</h1>
          </header>
          <p className="lede">{copy.noAccess}</p>
        </div>
      </PsychShell>
    );
  }

  return (
    <PsychShell locale={locale} active="console">
      <ConsolePanel locale={locale} copy={copy} />
    </PsychShell>
  );
}
