import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  CalendarRange,
  Flame,
  Star,
  UtensilsCrossed,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ExploreModules } from "@/components/explore-modules";
import { HeroGallery } from "@/components/sections/hero-gallery";
import {
  dietFeatures,
  dietHeroImages,
  dietHeroImagePositions,
  dietMealLabelKeys,
  dietPlans,
  dietRecipes,
  dietSchedule,
  dietScheduleDays,
  dietStories,
  dietVenues,
  type DietLevel,
  type DietMealId,
} from "@/lib/content/diet";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dietHome" });

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

const levelLabelKeys: Record<DietLevel, string> = {
  beginner: "levelBeginner",
  intermediate: "levelIntermediate",
  advanced: "levelAdvanced",
};

const mealDotColors: Record<DietMealId, string> = {
  protein: "var(--diet-amber)",
  plant: "var(--diet-leaf)",
  light: "var(--diet-gold)",
  chef: "var(--diet-dot-chef)",
};

function Eyebrow({ children }: { children: string }) {
  return (
    <p className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground">
      <span
        aria-hidden
        className="h-px w-9 shrink-0"
        style={{ backgroundColor: "var(--diet-amber)" }}
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
          style={{ color: "var(--diet-gold)" }}
        />
      ))}
    </span>
  );
}

export default async function DietPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "dietHome" });
  const tc = await getTranslations({ locale, namespace: "moduleCommon" });

  const heroStats = [
    { value: t("heroStatRecipesValue"), label: t("heroStatRecipesLabel") },
    { value: t("heroStatExpertsValue"), label: t("heroStatExpertsLabel") },
    { value: t("heroStatVenuesValue"), label: t("heroStatVenuesLabel") },
  ];

  const marqueeWords = t("marqueeItems")
    .split("\u2022")
    .map((word) => word.trim())
    .filter(Boolean);

  return (
    <>
      {/* Hero */}
      <section id="top" className="relative isolate overflow-hidden">
        {/* Hero gallery — BetterMe-style picture switcher (liquid-glass
            controls live inside the component; scrims still paint above) */}
        <HeroGallery
          images={dietHeroImages}
          positions={dietHeroImagePositions}
          label={tc("galleryLabel")}
        />
        {/* Scrims are shared classes (.pl-hero-*) fed by --hero-* tokens,
            so the whole hero re-tints when the dark toggle flips .dark. */}
        <div aria-hidden className="pl-hero-side absolute inset-0 -z-10" />
        <div aria-hidden className="pl-hero-fade absolute inset-0 -z-10" />
        <div
          aria-hidden
          className="pl-hero-glow absolute inset-x-0 bottom-0 -z-10 h-[45%]"
        />
        <div className="mx-auto flex min-h-[88svh] max-w-6xl flex-col justify-end px-4 pb-24 pt-28 md:px-6 md:pb-32">
          <p className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.3em]">
            <span
              aria-hidden
              className="h-px w-10 shrink-0"
              style={{ backgroundColor: "var(--diet-amber)" }}
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
              <a href="#plans">{t("heroCtaPrimary")}</a>
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
              <a href="#venues">{t("heroCtaSecondary")}</a>
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
          borderColor: "var(--diet-line)",
          backgroundColor: "var(--diet-amber-deep)",
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
                      style={{ color: "#FBF3E1" }}
                    >
                      {word}
                    </span>
                    <span
                      aria-hidden
                      className="text-[0.62em]"
                      style={{ color: "var(--diet-gold)" }}
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

      {/* Why PreLife Diet */}
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
            {dietFeatures.map((feature) => {
              const Icon = feature.icon;
              return (
                <li key={feature.id} className="pl-reveal h-full">
                  <Card className="h-full gap-0 rounded-3xl border-border bg-card p-6 transition-colors duration-300 hover:border-[var(--diet-amber)]">
                    <span
                      aria-hidden
                      className="inline-flex size-11 items-center justify-center rounded-2xl"
                      style={{
                        backgroundColor: "var(--diet-amber-soft)",
                        color: "var(--diet-amber)",
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

      {/* Nutrition plans */}
      <section id="plans" className="scroll-mt-24">
        <div className="mx-auto max-w-6xl px-4 pb-16 md:px-6 md:pb-24">
          <div className="max-w-2xl">
            <Eyebrow>{t("plansEyebrow")}</Eyebrow>
            <h2 className="pl-display mt-4 text-3xl font-extrabold tracking-tight md:text-5xl md:leading-[1.05]">
              {t("plansTitle")}
            </h2>
            <p className="mt-4 text-muted-foreground">{t("plansSubtitle")}</p>
          </div>
          <ul className="mt-12 grid gap-6 md:grid-cols-3">
            {dietPlans.map((plan) => {
              const content = (
                <>
                  <div
                    aria-hidden
                    className="h-44 bg-cover bg-center"
                    style={{ backgroundImage: `url(${plan.image})` }}
                  />
                  <div className="flex flex-1 flex-col p-6">
                    <div className="flex items-center justify-between gap-2">
                      <Badge className="rounded-full">{t(levelLabelKeys[plan.level])}</Badge>
                    </div>
                    <h3 className="pl-display mt-4 text-xl font-extrabold tracking-tight">
                      {t(plan.nameKey)}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {t(plan.descKey)}
                    </p>
                    <ul className="mt-5 space-y-2.5 text-sm text-muted-foreground">
                      <li className="flex items-center gap-2.5">
                        <UtensilsCrossed
                          aria-hidden
                          className="size-4"
                          style={{ color: "var(--diet-amber)" }}
                        />
                        {t("plansMetaMeals", { count: plan.mealsPerDay })}
                      </li>
                      <li className="flex items-center gap-2.5">
                        <CalendarRange
                          aria-hidden
                          className="size-4"
                          style={{ color: "var(--diet-amber)" }}
                        />
                        {t("plansMetaWeeks", { count: plan.weeks })}
                      </li>
                      <li className="flex items-center gap-2.5">
                        <Flame
                          aria-hidden
                          className="size-4"
                          style={{ color: "var(--diet-amber)" }}
                        />
                        {t("plansMetaKcal", { count: plan.kcal })}
                      </li>
                    </ul>
                  </div>
                </>
              );

              if (plan.featured) {
                return (
                  <li key={plan.id} className="pl-reveal relative h-full">
                    <span
                      className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-widest"
                      style={{
                        backgroundColor: "var(--diet-amber)",
                        color: "#FFFFFF",
                      }}
                    >
                      {t("plansMostPopular")}
                    </span>
                    <div
                      className="h-full rounded-[1.75rem] p-[1.5px]"
                      style={{
                        backgroundImage:
                          "linear-gradient(140deg, var(--diet-amber) 0%, var(--diet-honey) 55%, var(--diet-amber-deep) 100%)",
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
                <li key={plan.id} className="pl-reveal h-full">
                  <Card className="h-full gap-0 overflow-hidden rounded-[1.75rem] border-border bg-card py-0 transition-all duration-300 hover:-translate-y-1 hover:border-[var(--diet-amber)] hover:shadow-xl hover:shadow-amber-900/10">
                    {content}
                  </Card>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Recipe library */}
      <section
        id="recipes"
        className="scroll-mt-24 border-y"
        style={{ borderColor: "var(--diet-line)", backgroundColor: "var(--diet-elevated)" }}
      >
        <div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24">
          <div className="max-w-2xl">
            <Eyebrow>{t("recipesEyebrow")}</Eyebrow>
            <h2 className="pl-display mt-4 text-3xl font-extrabold tracking-tight md:text-5xl md:leading-[1.05]">
              {t("recipesTitle")}
            </h2>
            <p className="mt-4 text-muted-foreground">{t("recipesSubtitle")}</p>
          </div>
          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {dietRecipes.map((recipe, index) => {
              const Icon = recipe.icon;
              return (
                <li key={recipe.id} className="pl-reveal h-full">
                  <Card className="h-full flex-row items-center gap-4 rounded-2xl border-border bg-card p-5 transition-colors duration-300 hover:border-[var(--diet-amber)]">
                    <span
                      aria-hidden
                      className="pl-display w-8 shrink-0 text-xl font-black tabular-nums"
                      style={{ color: "var(--diet-amber)" }}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span
                      aria-hidden
                      className="h-9 w-px shrink-0"
                      style={{ backgroundColor: "var(--diet-line)" }}
                    />
                    <span
                      aria-hidden
                      className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground"
                    >
                      <Icon className="size-5" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold">{t(recipe.nameKey)}</h3>
                      <p className="truncate text-sm text-muted-foreground">
                        {t(recipe.targetKey)}
                      </p>
                    </div>
                    <Badge
                      variant="secondary"
                      className="ml-auto shrink-0 rounded-full"
                    >
                      {t(levelLabelKeys[recipe.level])}
                    </Badge>
                  </Card>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Weekly meal schedule */}
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
            style={{ borderColor: "var(--diet-line)" }}
          >
            <div className="overflow-x-auto">
              <div className="min-w-[760px]">
                <div
                  className="grid grid-cols-[130px_repeat(6,1fr)] border-b"
                  style={{
                    borderColor: "var(--diet-line)",
                    backgroundColor: "rgba(217, 119, 6, 0.12)",
                  }}
                >
                  <div className="px-5 py-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    {t("scheduleTime")}
                  </div>
                  {dietScheduleDays.map((dayKey) => (
                    <div
                      key={dayKey}
                      className="pl-display px-3 py-4 text-center text-sm font-bold tracking-wide"
                    >
                      {t(dayKey)}
                    </div>
                  ))}
                </div>
                {dietSchedule.map((slot, slotIndex) => (
                  <div
                    key={slot.time}
                    className="grid grid-cols-[130px_repeat(6,1fr)] border-b last:border-b-0"
                    style={{
                      borderColor: "var(--diet-line)",
                      backgroundColor:
                        slotIndex % 2 === 1 ? "rgba(36, 23, 8, 0.02)" : "transparent",
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
                    {slot.meals.map((mealId, dayIndex) => (
                      <div
                        key={`${slot.time}-${dayIndex}`}
                        className="flex items-center justify-center gap-2 px-3 py-4 text-sm"
                      >
                        <span
                          aria-hidden
                          className="size-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: mealDotColors[mealId] }}
                        />
                        <span className="text-center leading-tight">
                          {t(dietMealLabelKeys[mealId])}
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
              style={{ backgroundColor: "var(--diet-leaf)" }}
            />
            {t("scheduleRestNote")}
          </p>
        </div>
      </section>

      {/* Member stories */}
      <section
        id="stories"
        className="scroll-mt-24 border-y"
        style={{ borderColor: "var(--diet-line)", backgroundColor: "var(--diet-elevated)" }}
      >
        <div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24">
          <div className="max-w-2xl">
            <Eyebrow>{t("storiesEyebrow")}</Eyebrow>
            <h2 className="pl-display mt-4 text-3xl font-extrabold tracking-tight md:text-5xl md:leading-[1.05]">
              {t("storiesTitle")}
            </h2>
          </div>
          <ul className="mt-12 grid gap-4 md:grid-cols-3">
            {dietStories.map((story) => (
              <li key={story.id} className="pl-reveal h-full">
                <Card className="h-full gap-0 rounded-3xl border-border bg-card p-6">
                  <Stars className="size-3.5" />
                  <p className="mt-4 flex-1 text-[15px] leading-relaxed text-foreground/90">
                    {"\u201C"}{t(story.quoteKey)}{"\u201D"}
                  </p>
                  <div
                    className="mt-6 flex items-center gap-3 border-t pt-5"
                    style={{ borderColor: "var(--diet-line)" }}
                  >
                    <span
                      aria-hidden
                      className="pl-display inline-flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                      style={{
                        backgroundColor: "var(--diet-honey)",
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

      {/* Partner venues */}
      <section id="venues" className="scroll-mt-24">
        <div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24">
          <div className="max-w-2xl">
            <Eyebrow>{t("venuesEyebrow")}</Eyebrow>
            <h2 className="pl-display mt-4 text-3xl font-extrabold tracking-tight md:text-5xl md:leading-[1.05]">
              {t("venuesTitle")}
            </h2>
            <p className="mt-4 text-muted-foreground">{t("venuesSubtitle")}</p>
          </div>
          <ul className="mt-12 grid gap-6 md:grid-cols-3">
            {dietVenues.map((venue) => (
              <li key={venue.id} className="pl-reveal h-full">
                <Card className="h-full gap-0 overflow-hidden rounded-3xl border-border bg-card py-0 transition-all duration-300 hover:-translate-y-1 hover:border-[var(--diet-amber)] hover:shadow-xl hover:shadow-amber-900/10">
                  <div
                    aria-hidden
                    className="h-44 bg-cover bg-center"
                    style={{ backgroundImage: `url(${venue.image})` }}
                  />
                  <div className="flex flex-1 flex-col p-6">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="pl-display text-lg font-extrabold tracking-tight">
                        {t(venue.nameKey)}
                      </h3>
                      <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
                        <Star
                          aria-hidden
                          className="size-4 fill-current"
                          style={{ color: "var(--diet-gold)" }}
                        />
                        <span>{venue.rating}</span>
                        <span className="sr-only">
                          {t("venuesRatingA11y", { score: venue.rating })}
                        </span>
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {t(venue.descKey)}
                    </p>
                    <ul className="mt-auto flex flex-wrap gap-2 pt-5">
                      {venue.featureKeys.map((featureKey) => (
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
            borderColor: "var(--diet-line)",
            backgroundImage:
              "linear-gradient(125deg, var(--diet-amber-deep) 0%, var(--diet-honey) 52%, #C2711B 100%)",
          }}
        >
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(50% 85% at 82% 6%, rgba(255, 214, 130, 0.35) 0%, rgba(255, 214, 130, 0) 65%)",
            }}
          />
          <div className="relative">
            <h2
              className="pl-display mx-auto max-w-2xl text-3xl font-black tracking-tight md:text-5xl md:leading-[1.05]"
              style={{ color: "#FFF7E8" }}
            >
              {t("ctaTitle")}
            </h2>
            <p
              className="mx-auto mt-4 max-w-xl text-base leading-relaxed"
              style={{ color: "rgba(255, 247, 232, 0.78)" }}
            >
              {t("ctaSubtitle")}
            </p>
            <a
              href="#top"
              className="mt-9 inline-flex h-12 items-center rounded-full bg-white px-8 text-base font-semibold text-[#7C3A08] transition-all hover:brightness-105"
            >
              {t("ctaButton")}
            </a>
            <p
              className="mt-6 text-sm"
              style={{ color: "rgba(255, 247, 232, 0.78)" }}
            >
              {t("ctaNote")}
            </p>
          </div>
        </div>
      </section>

      <ExploreModules current="diet" locale={locale} />
    </>
  );
}
