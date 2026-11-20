import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getMeditationContent, getJournalData } from "@/lib/api";
import {
  bakuParts, dayRotated,
} from "@/lib/psychology";
import { JournalCard } from "@/components/psych/JournalCard";
import { JournalHistory, type JournalDay } from "@/components/psych/JournalHistory";
import { JournalList } from "@/components/psych/JournalList";
import { PsychShell } from "@/components/psych/PsychShell";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "psychApp" });
  return { title: t("journalMetaTitle"), description: t("journalMetaDescription") };
}

export default async function JournalPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "psychApp" });
  await requireUser(locale, "/meditation/journal");

  // Entries + the mood check-ins that pair with journal days both come
  // from the Rust API (Supabase Postgres).
  const [contentData, journal] = await Promise.all([
    getMeditationContent(), getJournalData(),
  ]);
  const promptKeys = contentData?.promptKeys ?? [];
  const rows = journal?.entries ?? [];
  const moodByDate = new Map((journal?.moods ?? []).map((m) => [m.date, m]));

  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: "long", timeStyle: "short" });
  const dayFmt = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" });
  const promptKey = dayRotated(promptKeys);

  /* Group entries by Baku calendar date, newest day first. */
  const byDay = new Map<string, JournalDay>();
  for (const r of rows) {
    const date = bakuParts(new Date(r.createdAt)).date;
    let day = byDay.get(date);
    if (!day) {
      const mood = moodByDate.get(date);
      day = {
        date,
        label: dayFmt.format(new Date(`${date}T12:00:00Z`)),
        mood: mood
          ? t("moodOfDayLine", { mood: mood.mood, energy: mood.energy, sleep: mood.sleepQ })
          : null,
        entries: [],
      };
      byDay.set(date, day);
    }
    day.entries.push({
      id: r.id,
      createdAt: fmt.format(new Date(r.createdAt)),
      // Translate the stored prompt message key server-side; legacy
      // rows that predate real keys (or unknown values) show no tag.
      prompt: r.promptKey && promptKeys.includes(r.promptKey)
        ? t(r.promptKey)
        : null,
      content: r.content,
    });
  }
  const days = [...byDay.values()].sort((a, b) => (a.date < b.date ? 1 : -1));

  const today = bakuParts(new Date()).date;
  const minDate = days.length > 0
    ? (days[days.length - 1]!.date < today ? days[days.length - 1]!.date : today)
    : today;

  return (
    <PsychShell locale={locale} active="journal">
      <div className="wrap">
        <header className="page-head">
          <p className="eyebrow"><i /><Link href="/meditation" className="backlink" aria-label={t("backToSection")}><ArrowLeft size={14} aria-hidden /></Link>{t("journalPageEyebrow")}</p>
          <h1 className="display sm">{t("journalPageTitle")}</h1>
          <p className="lede">{t("journalPageSubtitle")}</p>
        </header>

        <section aria-labelledby="write-h" className="blk">
          <h2 id="write-h" className="eyebrow"><b>01</b>{t("journalEyebrow")}</h2>
          <JournalCard prompt={t(promptKey)} promptKey={promptKey} />
        </section>

        <section aria-labelledby="history-h" className="blk">
          <h2 id="history-h" className="eyebrow"><b>02</b>{t("journalHistoryEyebrow")}</h2>
          <JournalHistory days={days} today={today} minDate={minDate} />
        </section>

        <section aria-labelledby="archive-h" className="blk">
          <h2 id="archive-h" className="eyebrow"><b>03</b>{t("journalArchive")}</h2>
          <JournalList
            entries={rows.slice(0, 50).map((r) => ({
              id: r.id,
              createdAt: fmt.format(new Date(r.createdAt)),
              prompt: r.promptKey && promptKeys.includes(r.promptKey)
                ? t(r.promptKey)
                : null,
              content: r.content,
            }))}
          />
        </section>
      </div>
    </PsychShell>
  );
}
