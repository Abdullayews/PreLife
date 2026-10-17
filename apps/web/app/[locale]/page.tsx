import { ArrowRight } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { MODULES } from "@/lib/modules";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function LandingPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("welcome");
  const tNav = await getTranslations("nav");
  const tLanding = await getTranslations("landing");
  const tModules = await getTranslations("modules");

  const reasons = [
    { title: tLanding("reason1Title"), text: tLanding("reason1Text") },
    { title: tLanding("reason2Title"), text: tLanding("reason2Text") },
    { title: tLanding("reason3Title"), text: tLanding("reason3Text") },
  ];

  return (
    <>
      <section className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-4 pb-20 pt-16 text-center sm:px-6 sm:pt-24">
        <h1 className="max-w-3xl text-balance text-4xl font-bold tracking-tight sm:text-5xl">
          {t("title")}
        </h1>
        <p className="max-w-2xl text-balance text-lg text-muted-foreground">
          {t("subtitle")}
        </p>
        <Button asChild size="lg">
          <Link href="/gym">
            {t("cta")}
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </section>

      <section className="border-t bg-muted/40">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {tLanding("modulesTitle")}
          </h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            {tLanding("modulesSubtitle")}
          </p>
          <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {MODULES.map((module) => (
              <li key={module.slug}>
                <Link
                  href={`/${module.slug}`}
                  className="flex h-full flex-col gap-3 rounded-xl border bg-card p-5 transition-colors hover:border-foreground/25"
                >
                  <module.icon
                    className="size-6"
                    style={{ color: module.accent }}
                    aria-hidden="true"
                  />
                  <span className="font-semibold">{tNav(module.slug)}</span>
                  <span className="text-sm text-muted-foreground">
                    {tModules(module.slug)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-t">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {tLanding("reasonsTitle")}
          </h2>
          <ul className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-3">
            {reasons.map((reason) => (
              <li key={reason.title} className="flex flex-col gap-2">
                <span className="flex size-8 items-center justify-center rounded-full bg-muted font-mono text-sm text-muted-foreground">
                  {reasons.indexOf(reason) + 1}
                </span>
                <h3 className="mt-2 font-semibold">{reason.title}</h3>
                <p className="text-sm text-muted-foreground">{reason.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
