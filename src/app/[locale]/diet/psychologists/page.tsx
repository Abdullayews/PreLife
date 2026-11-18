import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ArrowLeft, Clock, Globe, MapPin, Star } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  PSYCHOLOGISTS, SPECIALTY_ICONS, buildSchedule, fitAll,
  type PsyFormat, type PsySpecialty, type PsyWeekday,
} from "@/lib/diet";
import { PsychologistFilter } from "@/components/diet/PsychologistFilter";
import { ScheduleBook } from "@/components/diet/ScheduleBook";
import { DietShell } from "@/components/diet/DietShell";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ sp?: string; days?: string; from?: string; to?: string; fmt?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dietApp" });
  return { title: t("psychMetaTitle"), description: t("psychMetaDescription") };
}

const WEEKDAYS: PsyWeekday[] = [1, 2, 3, 4, 5, 6];

export default async function PsychologistsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale, "/diet/psychologists");

  const t = await getTranslations({ locale, namespace: "dietApp" });
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
  const results = fitAll({ days, from, to, specialty, format });

  // Booking grid data: everyone's active bookings inside the window.
  const windowStart = new Date();
  const windowEnd = new Date(windowStart.getTime() + 14 * 86_400_000);
  const bookings = await db.appointment.findMany({
    where: {
      psychologistSlug: { in: PSYCHOLOGISTS.map((p) => p.slug) },
      startAt: { gte: windowStart, lte: windowEnd },
      status: { not: "cancelled" },
    },
    select: { userId: true, psychologistSlug: true, startAt: true },
  });
  const mine = bookings
    .filter((b) => b.userId === user.id)
    .map((b) => ({ startAt: b.startAt, psychologistSlug: b.psychologistSlug }));
  const all = bookings.map((b) => ({ startAt: b.startAt, psychologistSlug: b.psychologistSlug }));

  const dayNames = Object.fromEntries(
    WEEKDAYS.map((d) => [d, tm(`scheduleDay${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d - 1]}`)]),
  ) as Record<PsyWeekday, string>;
  const monthNames = Object.fromEntries(
    Array.from({ length: 12 }, (_, i) => [i + 1, t(`month${i + 1}`)]),
  ) as Record<string, string>;

  return (
    <DietShell locale={locale} active="psychologists">
      <div className="wrap">
        <header className="page-head">
          <p className="eyebrow"><i /><Link href="/diet" className="backlink"><ArrowLeft size={14} aria-hidden /></Link>{t("psychEyebrow")}</p>
          <h1 className="display sm">{t("psychTitle")}</h1>
          <p className="lede">{t("psychSubtitle")}</p>
        </header>

        <PsychologistFilter dayNames={dayNames} />

        <ul className="psy-list">
          {results.map(({ psy, score, dayHits, hourHits }) => {
            const columns = buildSchedule(psy, new Date(), mine, all, 14);
            return (
              <li key={psy.slug} className="psy-card">
                <div className="psy-main">
                  <img className="psy-photo" src={psy.image} alt="" width={640} height={640} loading="lazy" decoding="async" />
                  <div className="psy-id">
                    <div className="place-top">
                      <h3>{t(psy.nameKey)}</h3>
                      <span className="score">
                        <Star size={14} fill="currentColor" aria-hidden />
                        {psy.rating.toFixed(1)}
                      </span>
                    </div>
                    <p className="tag tinted">{t(psy.titleKey)}</p>
                    <p>{t(psy.bioKey)}</p>
                    <ul className="chips">
                      {psy.specialties.map((s) => {
                        const Icon = SPECIALTY_ICONS[s];
                        return <li key={s}><Icon size={13} aria-hidden />{t(`specialty_${s}`)}</li>;
                      })}
                    </ul>
                    <div className="psy-meta">
                      <span><Clock size={13} aria-hidden /> <b>{psy.price} AZN</b> / {t("sessionUnit")}</span>
                      <span><MapPin size={13} aria-hidden /> {psy.formats.map((f) => t(`format_${f}`)).join(" · ")}</span>
                      <span><Globe size={13} aria-hidden /> {psy.languages.map((l) => l.toUpperCase()).join(" · ")}</span>
                    </div>
                    <div className="psy-actions">
                      <span className="fit-tag">
                        {dayHits > 0
                          ? from < to
                            ? t("fitTagDays", { days: dayHits, hours: hourHits, score })
                            : t("fitTagDaysOnly", { days: dayHits, score })
                          : t("fitTagNone", { score })}
                      </span>
                    </div>
                  </div>
                </div>
                <ScheduleBook slug={psy.slug} price={psy.price} columns={columns} dayNames={dayNames} monthNames={monthNames} />
              </li>
            );
          })}
        </ul>
      </div>
    </DietShell>
  );
}
