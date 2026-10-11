import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  CalendarRange,
  Star,
  Timer,
  Waves,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ExploreModules } from "@/components/explore-modules";
import {
  meditationFeatures,
  meditationHeroImage,
  meditationMentors,
  meditationPrograms,
  meditationSchedule,
  meditationScheduleDays,
  meditationSessions,
  meditationStories,
  meditationTrackLabelKeys,
  type MeditationLevel,
  type MeditationTrackId,
} from "@/lib/content/meditation";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meditationHome" });

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

const levelLabelKeys: Record<MeditationLevel, string> = {
  beginner: "levelBeginner",
  intermediate: "levelIntermediate",
  advanced: "levelAdvanced",
};

const trackDotColors: Record<MeditationTrackId, string> = {
  breathe: "var(--med-violet)",
  focus: "var(--med-lilac)",
  sleep: "var(--med-violet-deep)",
  rest: "rgba(139, 131, 166, 0.85)",
};

function Eyebrow({ children }: { children: string }) {
  return (
    <p className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground">
      <span
        aria-hidden
        className="h-px w-9 shrink-0"
        style={{ backgroundColor: "var(--med-violet)" }}
      />
      {children}
    </p>
  );
}

function Stars({ className = "size-4" }: { className?: string }) {
  return (
    <span aria-hidden className="inline-flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          className={`${className} fill-current`}
          style={{ color: "var(--med-gold)" }}
        />
      ))}
    </span>
  );
}

export default async function MeditationPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "meditationHome" });

  const heroStats = [
    { value: t("heroStatSessionsValue"), label: t("heroStatSessionsLabel") },
    { value: t("heroStatMentorsValue"), label: t("heroStatMentorsLabel") },
    { value: t("heroStatSleepValue"), label: t("heroStatSleepLabel") },
  ];

  const marqueeWords = t("marqueeItems")
    .split("\u2022")
    .map((word) => word.trim())
    .filter(Boolean);

  return (
    <>
      {/* Hero */}
      <section id="top" className="relative isolate overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 -z-20 bg-cover bg-[center_38%]"
          style={{ backgroundImage: `url(${meditationHeroImage})` }}
        />
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            backgroundImage:
              "linear-gradient(90deg, rgba(247, 245, 252, 0.78) 0%, rgba(247, 245, 252, 0) 55%), linear-gradient(to top, #F7F5FC 0%, rgba(247, 245, 252, 0.88) 24%, rgba(247, 245, 252, 0.42) 56%, rgba(247, 245, 252, 0.60) 100%)",
          }}
        />
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 -z-10 h-[45%]"
          style={{
            backgroundImage:
              "radial-gradient(55% 90% at 14% 100%, rgba(124, 58, 237, 0.16) 0%, rgba(124, 58, 237, 0) 70%)",
          }}
        />
        <div className="mx-auto flex min-h-[88svh] max-w-6xl flex-col justify-end px-4 pb-14 pt-28 md:px-6 md:pb-20">
          <p className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.3em]">
            <span
              aria-hidden
              className="h-px w-10 shrink-0"
              style={{ backgroundColor: "var(--med-violet)" }}
            />
            <span style={{ color: "var(--on-hero-muted)" }}>
              {t("heroEyebrow")}
            </span>
          </p>
          <h1
            className="pl-display mt-6 max-w-4xl text-5xl font-black leading-[0.98] tracking-[-0.03em] md:text-7xl lg:text-[5.25rem]"
            style={{ color: "var(--on-hero)" }}
          >
            {t("heroTitle")}
          </h1>
          <p
            className="mt-6 max-w-xl text-base leading-relaxed md:text-lg"
            style={{ color: "var(--on-hero-muted)" }}
          >
            {t("heroSubtitle")}
          </p>
          <div className="mt-6 flex items-center gap-2.5">
            <Stars />
            <span className="text-sm" style={{ color: "var(--on-hero-muted)" }}>
              {t("heroRating")}
            </span>
          </div>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Button
              asChild
              className="h-12 rounded-full px-8 text-base font-semibold hover:brightness-110"
            >
              <a href="#programs">{t("heroCtaPrimary")}</a>
            </Button>
            <Button
              asChild
              variant="ghost"
              className="pl-hero-ghost h-12 rounded-full border px-7 text-base font-medium backdrop-blur transition-colors"
              style={{
                borderColor: "var(--on-hero-border)",
                backgroundColor: "var(--on-hero-fill)",
                color: "var(--on-hero)",
              }}
            >
              <a href="#mentors">{t("heroCtaSecondary")}</a>
            </Button>
          </div>
          <dl
            className="mt-14 grid max-w-2xl grid-cols-3 gap-6 border-t pt-7"
            style={{ borderColor: "var(--on-hero-border)" }}
          >
            {heroStats.map((stat) => (
              <div key={stat.label}>
                <dd
                  className="pl-display text-3xl font-extrabold tracking-tight md:text-4xl"
                  style={{ color: "var(--on-hero)" }}
                >
                  {stat.value}
                </dd>
                <dt
                  className="mt-1 text-xs md:text-sm"
                  style={{ color: "var(--on-hero-muted)" }}
                >
                  {stat.label}
                </dt>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Marquee band */}
      <div
        className="overflow-hidden border-y py-4"
        style={{
          borderColor: "var(--med-line)",
          backgroundColor: "var(--med-violet-deep)",
        }}
      >
        <div className="pl-marquee overflow-hidden">
          <div className="pl-marquee-track flex w-max items-center">
            {[0, 1].map((copy) => (
              <div
                key={copy}
                aria-hidden={copy === 1}
                className="flex items-center gap-10 pr-10"
              >
                {marqueeWords.map((word) => (
                  <span key={word} className="flex items-center gap-10">
                    <span
                      className="pl-display whitespace-nowrap text-sm font-bold uppercase tracking-[0.32em]"
                      style={{ color: "#F3EFFC" }}
                    >
                      {word}
                    </span>
                    <span
                      aria-hidden
                      className="text-[0.62em]"
                      style={{ color: "var(--med-lilac)" }}
                    >
                      {"\u2726"}
                    </span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Why PreLife Meditation */}
      <section id="why" className="scroll-mt-24">
        <div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24">
          <div className="max-w-2xl">
            <Eyebrow>{t("whyEyebrow")}</Eyebrow>
            <h2 className="pl-display mt-4 text-3xl font-extrabold tracking-tight md:text-5xl md:leading-[1.05]">
              {t("whyTitle")}
            </h2>
            <p className="mt-4 text-muted-foreground">{t("whySubtitle")}</p>
          </div>
          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {meditationFeatures.map((feature) => {
              const Icon = feature.icon;
              return (
                <li key={feature.id} className="pl-reveal h-full">
                  <Card className="h-full gap-0 rounded-3xl border-border bg-card p-6 transition-colors duration-300 hover:border-[var(--med-violet)]">
                    <span
                      aria-hidden
                      className="inline-flex size-11 items-center justify-center rounded-2xl"
                      style={{
                        backgroundColor: "var(--med-violet-soft)",
                        color: "var(--med-violet)",
                      }}
                    >
                      <Icon className="size-5" />
                    </span>
                    <h3 className="pl-display mt-5 text-lg font-extrabold tracking-tight">
                      {t(feature.titleKey)}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {t(feature.descKey)}
                    </p>
                  </Card>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Programs */}
      <section id="programs" className="scroll-mt-24">
        <div className="mx-auto max-w-6xl px-4 pb-16 md:px-6 md:pb-24">
          <div className="max-w-2xl">
            <Eyebrow>{t("plansEyebrow")}</Eyebrow>
            <h2 className="pl-display mt-4 text-3xl font-extrabold tracking-tight md:text-5xl md:leading-[1.05]">
              {t("plansTitle")}
            </h2>
            <p className="mt-4 text-muted-foreground">{t("plansSubtitle")}</p>
          </div>
          <ul className="mt-12 grid gap-6 md:grid-cols-3">
            {meditationPrograms.map((program) => {
              const content = (
                <>
                  <div
                    aria-hidden
                    className="h-44 bg-cover bg-center"
                    style={{ backgroundImage: `url(${program.image})` }}
                  />
                  <div className="flex flex-1 flex-col p-6">
                    <div className="flex items-center justify-between gap-2">
                      <Badge className="rounded-full">{t(levelLabelKeys[program.level])}</Badge>
                    </div>
                    <h3 className="pl-display mt-4 text-xl font-extrabold tracking-tight">
                      {t(program.nameKey)}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {t(program.descKey)}
                    </p>
                    <ul className="mt-5 space-y-2.5 text-sm text-muted-foreground">
                      <li className="flex items-center gap-2.5">
                        <Timer
                          aria-hidden
                          className="size-4"
                          style={{ color: "var(--med-violet)" }}
                        />
                        {t("plansMetaMinutes", { count: program.minutesPerDay })}
                      </li>
                      <li className="flex items-center gap-2.5">
                        <CalendarRange
                          aria-hidden
                          className="size-4"
                          style={{ color: "var(--med-violet)" }}
                        />
                        {t("plansMetaDays", { count: program.days })}
                      </li>
                      <li className="flex items-center gap-2.5">
                        <Waves
                          aria-hidden
                          className="size-4"
                          style={{ color: "var(--med-violet)" }}
                        />
                        {t("plansMetaSessions", { count: program.sessionsPerWeek })}
                      </li>
                    </ul>
                  </div>
                </>
              );

              if (program.featured) {
                return (
                  <li key={program.id} className="pl-reveal relative h-full">
                    <span
                      className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-widest"
                      style={{
                        backgroundColor: "var(--med-violet)",
                        color: "#FFFFFF",
                      }}
                    >
                      {t("plansMostPopular")}
                    </span>
                    <div
                      className="h-full rounded-[1.75rem] p-[1.5px]"
                      style={{
                        backgroundImage:
                          "linear-gradient(140deg, var(--med-violet) 0%, var(--med-violet-deep) 55%, #37236B 100%)",
                      }}
                    >
                      <div className="flex h-full flex-col overflow-hidden rounded-[calc(1.75rem-1.5px)] bg-white">
                        {content}
                      </div>
                    </div>
                  </li>
                );
              }

              return (
                <li key={program.id} className="pl-reveal h-full">
                  <Card className="h-full gap-0 overflow-hidden rounded-[1.75rem] border-border bg-card py-0 transition-all duration-300 hover:-translate-y-1 hover:border-[var(--med-violet)] hover:shadow-xl hover:shadow-violet-900/10">
                    {content}
                  </Card>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Session library */}
      <section
        id="sessions"
        className="scroll-mt-24 border-y"
        style={{ borderColor: "var(--med-line)", backgroundColor: "var(--med-elevated)" }}
      >
        <div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24">
          <div className="max-w-2xl">
            <Eyebrow>{t("sessionsEyebrow")}</Eyebrow>
            <h2 className="pl-display mt-4 text-3xl font-extrabold tracking-tight md:text-5xl md:leading-[1.05]">
              {t("sessionsTitle")}
            </h2>
            <p className="mt-4 text-muted-foreground">{t("sessionsSubtitle")}</p>
          </div>
          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {meditationSessions.map((session, index) => {
              const Icon = session.icon;
              return (
                <li key={session.id} className="pl-reveal h-full">
                  <Card className="h-full flex-row items-center gap-4 rounded-2xl border-border bg-card p-5 transition-colors duration-300 hover:border-[var(--med-violet)]">
                    <span
                      aria-hidden
                      className="pl-display w-8 shrink-0 text-xl font-black tabular-nums"
                      style={{ color: "var(--med-violet)" }}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span
                      aria-hidden
                      className="h-9 w-px shrink-0"
                      style={{ backgroundColor: "var(--med-line)" }}
                    />
                    <span
                      aria-hidden
                      className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground"
                    >
                      <Icon className="size-5" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold">{t(session.nameKey)}</h3>
                      <p className="truncate text-sm text-muted-foreground">
                        {t(session.targetKey)}
                      </p>
                    </div>
                    <Badge
                      variant="secondary"
                      className="ml-auto shrink-0 rounded-full"
                    >
                      {t(levelLabelKeys[session.level])}
                    </Badge>
                  </Card>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Weekly rhythm */}
      <section id="schedule" className="scroll-mt-24">
        <div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24">
          <div className="max-w-2xl">
            <Eyebrow>{t("scheduleEyebrow")}</Eyebrow>
            <h2 className="pl-display mt-4 text-3xl font-extrabold tracking-tight md:text-5xl md:leading-[1.05]">
              {t("scheduleTitle")}
            </h2>
            <p className="mt-4 text-muted-foreground">{t("scheduleSubtitle")}</p>
          </div>
          <div
            className="pl-reveal mt-12 overflow-hidden rounded-3xl border bg-card"
            style={{ borderColor: "var(--med-line)" }}
          >
            <div className="overflow-x-auto">
              <div className="min-w-[760px]">
                <div
                  className="grid grid-cols-[130px_repeat(6,1fr)] border-b"
                  style={{
                    borderColor: "var(--med-line)",
                    backgroundColor: "rgba(124, 58, 237, 0.10)",
                  }}
                >
                  <div className="px-5 py-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    {t("scheduleTime")}
                  </div>
                  {meditationScheduleDays.map((dayKey) => (
                    <div
                      key={dayKey}
                      className="pl-display px-3 py-4 text-center text-sm font-bold tracking-wide"
                    >
                      {t(dayKey)}
                    </div>
                  ))}
                </div>
                {meditationSchedule.map((slot, slotIndex) => (
                  <div
                    key={slot.time}
                    className="grid grid-cols-[130px_repeat(6,1fr)] border-b last:border-b-0"
                    style={{
                      borderColor: "var(--med-line)",
                      backgroundColor:
                        slotIndex % 2 === 1 ? "rgba(30, 22, 51, 0.02)" : "transparent",
                    }}
                  >
                    <div className="flex flex-col justify-center px-5 py-4">
                      <span className="pl-display text-base font-extrabold tabular-nums">
                        {slot.time}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {t(slot.labelKey)}
                      </span>
                    </div>
                    {slot.tracks.map((trackId, dayIndex) => (
                      <div
                        key={`${slot.time}-${dayIndex}`}
                        className="flex items-center justify-center gap-2 px-3 py-4 text-sm"
                      >
                        <span
                          aria-hidden
                          className="size-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: trackDotColors[trackId] }}
                        />
                        <span className="text-center leading-tight">
                          {t(meditationTrackLabelKeys[trackId])}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <span
              aria-hidden
              className="inline-block size-1.5 rounded-full"
              style={{ backgroundColor: "var(--med-lilac)" }}
            />
            {t("scheduleRestNote")}
          </p>
        </div>
      </section>

      {/* Member stories */}
      <section
        id="stories"
        className="scroll-mt-24 border-y"
        style={{ borderColor: "var(--med-line)", backgroundColor: "var(--med-elevated)" }}
      >
        <div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24">
          <div className="max-w-2xl">
            <Eyebrow>{t("storiesEyebrow")}</Eyebrow>
            <h2 className="pl-display mt-4 text-3xl font-extrabold tracking-tight md:text-5xl md:leading-[1.05]">
              {t("storiesTitle")}
            </h2>
          </div>
          <ul className="mt-12 grid gap-4 md:grid-cols-3">
            {meditationStories.map((story) => (
              <li key={story.id} className="pl-reveal h-full">
                <Card className="h-full gap-0 rounded-3xl border-border bg-card p-6">
                  <Stars className="size-3.5" />
                  <p className="mt-4 flex-1 text-[15px] leading-relaxed text-foreground/90">
                    {"\u201C"}{t(story.quoteKey)}{"\u201D"}
                  </p>
                  <div
                    className="mt-6 flex items-center gap-3 border-t pt-5"
                    style={{ borderColor: "var(--med-line)" }}
                  >
                    <span
                      aria-hidden
                      className="pl-display inline-flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                      style={{
                        backgroundColor: "var(--med-violet-deep)",
                        color: "#FFFFFF",
                      }}
                    >
                      {story.initials}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {t(story.nameKey)}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {t(story.roleKey)}
                      </p>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Mentors */}
      <section id="mentors" className="scroll-mt-24">
        <div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24">
          <div className="max-w-2xl">
            <Eyebrow>{t("mentorsEyebrow")}</Eyebrow>
            <h2 className="pl-display mt-4 text-3xl font-extrabold tracking-tight md:text-5xl md:leading-[1.05]">
              {t("mentorsTitle")}
            </h2>
            <p className="mt-4 text-muted-foreground">{t("mentorsSubtitle")}</p>
          </div>
          <ul className="mt-12 grid gap-6 md:grid-cols-3">
            {meditationMentors.map((mentor) => (
              <li key={mentor.id} className="pl-reveal h-full">
                <Card className="h-full gap-0 overflow-hidden rounded-3xl border-border bg-card py-0 transition-all duration-300 hover:-translate-y-1 hover:border-[var(--med-violet)] hover:shadow-xl hover:shadow-violet-900/10">
                  <div
                    aria-hidden
                    className="h-56 bg-cover bg-center"
                    style={{ backgroundImage: `url(${mentor.image})` }}
                  />
                  <div className="flex flex-1 flex-col p-6">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="pl-display text-lg font-extrabold tracking-tight">
                        {t(mentor.nameKey)}
                      </h3>
                      <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
                        <Star
                          aria-hidden
                          className="size-4 fill-current"
                          style={{ color: "var(--med-gold)" }}
                        />
                        <span>{mentor.rating}</span>
                        <span className="sr-only">
                          {t("mentorsRatingA11y", { score: mentor.rating })}
                        </span>
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {t(mentor.descKey)}
                    </p>
                    <ul className="mt-auto flex flex-wrap gap-2 pt-5">
                      {mentor.featureKeys.map((featureKey) => (
                        <li key={featureKey}>
                          <Badge
                            variant="outline"
                            className="rounded-full text-xs font-normal text-muted-foreground"
                          >
                            {t(featureKey)}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="px-4 pb-16 md:px-6 md:pb-24">
        <div
          className="pl-reveal relative mx-auto max-w-6xl overflow-hidden rounded-[2.5rem] border px-6 py-16 text-center md:py-24"
          style={{
            borderColor: "var(--med-line)",
            backgroundImage:
              "linear-gradient(125deg, var(--med-violet-deep) 0%, #5B21B6 52%, #6D28D9 100%)",
          }}
        >
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(50% 85% at 82% 6%, rgba(167, 139, 250, 0.40) 0%, rgba(167, 139, 250, 0) 65%)",
            }}
          />
          <div className="relative">
            <h2
              className="pl-display mx-auto max-w-2xl text-3xl font-black tracking-tight md:text-5xl md:leading-[1.05]"
              style={{ color: "#F5F1FE" }}
            >
              {t("ctaTitle")}
            </h2>
            <p
              className="mx-auto mt-4 max-w-xl text-base leading-relaxed"
              style={{ color: "rgba(245, 241, 254, 0.78)" }}
            >
              {t("ctaSubtitle")}
            </p>
            <a
              href="#top"
              className="mt-9 inline-flex h-12 items-center rounded-full bg-white px-8 text-base font-semibold text-[#4C1D95] transition-all hover:brightness-105"
            >
              {t("ctaButton")}
            </a>
            <p
              className="mt-6 text-sm"
              style={{ color: "rgba(245, 241, 254, 0.78)" }}
            >
              {t("ctaNote")}
            </p>
          </div>
        </div>
      </section>

      <ExploreModules current="meditation" locale={locale} />
    </>
  );
}
