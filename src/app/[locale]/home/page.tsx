import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight, Crown } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HomeGuard } from "@/components/welcome/home-guard";
import { capstoneSections, getCapstoneSection } from "@/lib/capstone";

const sections = capstoneSections;

/* Today's picks: sport workout, diet recipe, psikoloji session. */
const PICKS = [
  { key: "pick1", sectionId: "sport" },
  { key: "pick2", sectionId: "diet" },
  { key: "pick3", sectionId: "psikoloji" },
] as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return {
    title: t("homeTitle"),
    description: t("homeDescription"),
  };
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "homePage" });
  const tm = await getTranslations({
    locale,
    namespace: "welcomePage.modules",
  });

  return (
    <>
      <HomeGuard />
      {/* Unified glass-pill site nav lives in the [locale] layout. */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12 md:px-8 md:py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {t("tagline")}
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight md:text-5xl">
          {t("title")}
        </h1>
        <p className="mt-4 max-w-xl text-muted-foreground">{t("placeholder")}</p>

        {/* Today strip — one light pick per domain */}
        <section aria-labelledby="today-heading" className="mt-12">
          <h2
            id="today-heading"
            className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground"
          >
            {t("today.eyebrow")}
          </h2>
          <ul className="mt-4 grid gap-4 md:grid-cols-3">
            {PICKS.map(({ key, sectionId }) => {
              const s = getCapstoneSection(sectionId);
              const Icon = s.icon;
              return (
                <li key={key}>
                  <Link href={s.href} className="group block h-full">
                    <Card className="h-full gap-4 py-5 transition-colors hover:border-foreground/25">
                      <CardContent className="flex h-full flex-col">
                        <div className="flex items-center gap-3">
                          <span
                            className="inline-flex size-10 items-center justify-center rounded-xl"
                            style={{ backgroundColor: s.tint, color: s.accent }}
                          >
                            <Icon className="size-5" aria-hidden="true" />
                          </span>
                          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                            {tm(`cards.${s.id}.name`)}
                          </p>
                        </div>
                        <p className="mt-3 font-medium leading-snug">
                          {t(`today.${key}.title`)}
                        </p>
                        <span className="mt-auto inline-flex items-center gap-1.5 pt-4 text-sm font-medium text-foreground/80 transition-colors group-hover:text-foreground">
                          {t("today.open")}
                          <ArrowRight
                            className="size-4 transition-transform group-hover:translate-x-0.5"
                            aria-hidden="true"
                          />
                        </span>
                      </CardContent>
                    </Card>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Section shortcuts */}
        <section aria-labelledby="sections-heading" className="mt-12">
          <h2
            id="sections-heading"
            className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground"
          >
            {t("sectionsEyebrow")}
          </h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                        {tm(`cards.${s.id}.name`)}
                      </h3>
                      <Link
                        href={s.href}
                        className="mt-auto inline-flex items-center gap-1.5 pt-5 text-sm font-medium text-foreground/90 transition-colors hover:text-foreground"
                      >
                        {tm("explore")}
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
        </section>

        {/* Abonelik banner */}
        <section className="mt-12">
          <Card className="overflow-hidden py-0">
            <CardContent className="flex flex-col items-start gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
              <div className="flex items-start gap-4">
                <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-foreground text-background">
                  <Crown className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-lg font-semibold">
                    {t("subscription.title")}
                  </h2>
                  <p className="mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">
                    {t("subscription.text")}
                  </p>
                </div>
              </div>
              <Button asChild size="lg" className="rounded-full px-7">
                <Link href="/subscription">{t("subscription.cta")}</Link>
              </Button>
            </CardContent>
          </Card>
        </section>
      </main>
    </>
  );
}
