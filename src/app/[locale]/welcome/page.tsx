import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Spotlight } from "@/components/welcome/spotlight";
import { StartCta } from "@/components/welcome/start-cta";
import { FlagCheck } from "@/components/welcome/flag-check";
import { capstoneSections } from "@/lib/capstone";

/* Display order (per product decision): Gym, Diet, Psychology, Books.
   Stats strip mirrors the same order: exercises, recipes, sessions, books. */
const STAT_KEYS = ["exercises", "recipes", "sessions", "books"] as const;
const REASON_KEYS = ["one", "two", "three"] as const;
const sections = capstoneSections;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return {
    title: t("welcomeTitle"),
    description: t("welcomeDescription"),
  };
}

export default async function WelcomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "welcomePage" });

  return (
    <>
      <FlagCheck />
      {/* Unified glass-pill site nav lives in the [locale] layout. */}
      <div className="flex flex-1 flex-col">
        {/* Hero — full-bleed photo hero, the same scale as the module tabs */}
        <Spotlight />

        {/* Stats strip */}
        <section className="mx-auto w-full max-w-6xl px-4 py-12 md:px-8 md:py-16">
          <ul className="grid grid-cols-2 gap-6 md:grid-cols-4 md:gap-8">
            {STAT_KEYS.map((key) => (
              <li key={key}>
                <p className="text-2xl font-bold tracking-tight md:text-4xl">
                  {t(`stats.items.${key}.value`)}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t(`stats.items.${key}.label`)}
                </p>
              </li>
            ))}
          </ul>
        </section>

        {/* Section cards */}
        <section id="modules" className="scroll-mt-24 border-t border-border/60">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 md:px-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {t("modules.eyebrow")}
            </p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight md:text-3xl">
              {t("modules.title")}
            </h2>
            <p className="mt-3 max-w-xl text-muted-foreground">
              {t("modules.subtitle")}
            </p>
            <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {sections.map((s) => {
                const Icon = s.icon;
                return (
                  <li key={s.id} className="h-full">
                    <Card className="group h-full gap-4 py-6 transition-colors hover:border-foreground/25">
                      <CardContent className="flex h-full flex-col">
                        <span
                          className="inline-flex size-11 items-center justify-center rounded-xl"
                          style={{
                            backgroundColor: s.tint,
                            color: s.accent,
                          }}
                        >
                          <Icon className="size-5" aria-hidden="true" />
                        </span>
                        <h3 className="mt-4 font-semibold">
                          {t(`modules.cards.${s.id}.name`)}
                        </h3>
                        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                          {t(`modules.cards.${s.id}.tagline`)}
                        </p>
                        <Link
                          href={s.href}
                          className="mt-auto inline-flex items-center gap-1.5 pt-5 text-sm font-medium text-foreground/90 transition-colors hover:text-foreground"
                        >
                          {t("modules.explore")}
                          <ArrowRight
                            className="size-4 transition-transform group-hover:translate-x-0.5"
                            aria-hidden="true"
                          />
                        </Link>
                      </CardContent>
                    </Card>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* Reasons */}
        <section className="bg-foreground/[0.03]">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 md:px-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {t("reasons.eyebrow")}
            </p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight md:text-3xl">
              {t("reasons.title")}
            </h2>
            <ul className="mt-10 grid gap-8 md:grid-cols-3 md:gap-10">
              {REASON_KEYS.map((key) => (
                <li key={key} className="border-t border-border pt-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    {t(`reasons.items.${key}.label`)}
                  </p>
                  <h3 className="mt-3 text-lg font-semibold">
                    {t(`reasons.items.${key}.title`)}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {t(`reasons.items.${key}.text`)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Get started band — Ultrahuman-style contrast card. Always dark:
            .pl-contrast-band tokens keep the ink surface in both modes
            (bg-foreground would flip to a bright slab in dark mode). */}
        <section id="get-started" className="scroll-mt-24 px-4 py-16 md:px-8">
          <div className="pl-contrast-band relative mx-auto max-w-6xl overflow-hidden rounded-3xl p-8 text-center md:p-14">
            {sections.map((s, i) => (
              <div
                key={s.id}
                aria-hidden="true"
                className="pl-glow absolute size-80 rounded-full opacity-25"
                style={{
                  /* Soft gradient glow — a blur(90px) filter would re-render
                      every frame of the drift; a radial gradient is free. */
                  background: `radial-gradient(circle, ${s.accent} 0%, transparent 70%)`,
                  ...(i === 0
                    ? { top: "-5rem", left: "-5rem" }
                    : i === 1
                      ? { bottom: "-5rem", left: "25%" }
                      : i === 2
                        ? { top: "-5rem", right: "25%" }
                        : { bottom: "-5rem", right: "-5rem" }),
                }}
              />
            ))}
            <div className="relative">
              <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
                {t("cta.title")}
              </h2>
              <p className="mx-auto mt-3 max-w-md text-(--contrast-ink-soft)">
                {t("cta.text")}
              </p>
              <div className="mt-8 flex justify-center">
                {/* Bone pill on the ink band in BOTH modes — the themed
                    secondary surface would sink into the dark band. The
                    explicit hover bg cancels the variant's hover tint. */}
                <StartCta
                  variant="secondary"
                  className="h-12 rounded-full bg-(--contrast-ink) px-8 text-base font-semibold text-(--contrast-bg) hover:bg-(--contrast-ink) hover:brightness-110"
                />
              </div>
              <p className="mt-4 text-xs text-(--contrast-ink-faint)">
                {t("cta.note")}
              </p>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
