import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getMeditationContent, getScheduleWindow } from "@/lib/api";
import {
  fitAll, buildSchedule,
  type PsyFormat, type PsySpecialty, type PsyWeekday,
} from "@/lib/psychology";
import { PsychologistFilter } from "@/components/psych/PsychologistFilter";
import { PsyCard, type PsyCardView } from "@/components/psych/PsyCard";
import { PsychShell } from "@/components/psych/PsychShell";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ sp?: string; days?: string; from?: string; to?: string; fmt?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "psychApp" });
  return { title: t("psychMetaTitle"), description: t("psychMetaDescription") };
}

const WEEKDAYS: PsyWeekday[] = [1, 2, 3, 4, 5, 6];

export default async function PsychologistsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUser(locale, "/meditation/psychologists");

  const t = await getTranslations({ locale, namespace: "psychApp" });
  const tm = await getTranslations({ locale, namespace: "meditationHome" });
  const sp = await searchParams;

  const days = (sp.days ?? "")
    .split(",")
    .filter(Boolean)
    .map(Number)
    .filter((d) => WEEKDAYS.includes(d as PsyWeekday)) as PsyWeekday[];
  const from = Math.min(23, Math.max(0, Number(sp.from) || 0));
  const to = Math.min(24, Math.max(0, Number(sp.to) || 0));
  const specialty = (["individual", "couples", "family", "child", "trauma", "group"].includes(sp.sp ?? "")
    ? sp.sp
    : "any") as PsySpecialty | "any";
  const format = (["online", "office"].includes(sp.fmt ?? "") ? sp.fmt : "any") as PsyFormat | "any";

  // Scored most→least suitable; zero-fit cut when a day filter is active.
  // The catalog and the 14-day booking window both come from the Rust API.
  const [contentData, windowData] = await Promise.all([
    getMeditationContent(), getScheduleWindow(),
  ]);
  const PSYCHOLOGISTS = contentData?.psychologists ?? [];
  const results = fitAll(PSYCHOLOGISTS, { days, from, to, specialty, format });

  const mine = (windowData?.mine ?? []).map((b) => ({
    startAt: new Date(b.startAt), psychologistSlug: b.psychologistSlug,
  }));
  const all = (windowData?.all ?? []).map((b) => ({
    startAt: new Date(b.startAt), psychologistSlug: b.psychologistSlug,
  }));

  const dayNames = Object.fromEntries(
    WEEKDAYS.map((d) => [d, tm(`scheduleDay${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d - 1]}`)]),
  ) as Record<PsyWeekday, string>;
  const monthNames = Object.fromEntries(
    Array.from({ length: 12 }, (_, i) => [i + 1, t(`month${i + 1}`)]),
  ) as Record<string, string>;

  return (
    <PsychShell locale={locale} active="psychologists">
      <div className="wrap">
        <header className="page-head">
          <p className="eyebrow"><i /><Link href="/meditation" className="backlink"><ArrowLeft size={14} aria-hidden /></Link>{t("psychEyebrow")}</p>
          <h1 className="display sm">{t("psychTitle")}</h1>
          <p className="lede">{t("psychSubtitle")}</p>
        </header>

        <PsychologistFilter dayNames={dayNames} count={PSYCHOLOGISTS.length} />

        <ul className="psy-list">
          {results.map(({ psy, score, dayHits, hourHits }) => {
            const view: PsyCardView = {
              slug: psy.slug,
              name: t(psy.nameKey),
              title: t(psy.titleKey),
              image: psy.image,
              rating: psy.rating,
              ratingA11y: t("psyRatingA11y", { score: psy.rating }),
              price: psy.price,
              sessionUnit: t("sessionUnit"),
              specialties: psy.specialties,
              formats: psy.formats.map((f) => t(`format_${f}`)),
              languages: psy.languages.map((l) => l.toUpperCase()).join(" · "),
              since: t("psySince", { year: psy.since }),
              edu: t(psy.eduKey),
              certs: psy.certKeys.map((c) => t(c)),
              rules: t(psy.rulesKey),
              columns: buildSchedule(psy, new Date(), mine, all, 14),
            };
            const fitTag = dayHits > 0
              ? from < to
                ? t("fitTagDays", { days: dayHits, hours: hourHits, score })
                : t("fitTagDaysOnly", { days: dayHits, score })
              : t("fitTagNone", { score });
            return (
              <PsyCard
                key={psy.slug}
                psy={view}
                dayNames={dayNames}
                monthNames={monthNames}
                fitTag={fitTag}
              />
            );
          })}
        </ul>
      </div>
    </PsychShell>
  );
}
