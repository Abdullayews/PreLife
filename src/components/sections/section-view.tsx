import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StartCta } from "@/components/welcome/start-cta";
import { PageShell } from "@/components/sections/page-shell";
import { getCapstoneSection, type CapstoneId } from "@/lib/capstone";
import { getSubSections, getSampleItems } from "@/lib/capstone-content";

/** Shared view for the four capstone section pages. */
export async function SectionView({ id }: { id: CapstoneId }) {
  const s = getCapstoneSection(id);
  const Icon = s.icon;
  const subs = getSubSections(id);
  const items = getSampleItems(id);
  const t = await getTranslations(`sections.${id}`);
  const tCommon = await getTranslations("sections");

  return (
    <PageShell pageId={id} accent={s.accent}>
      {/* Section hero — Ultrahuman-style tinted band */}
      <section
        className="mt-6 overflow-hidden rounded-3xl border p-8 md:p-12"
        style={{ backgroundColor: s.tint }}
      >
        <span
          className="inline-flex size-12 items-center justify-center rounded-2xl bg-card shadow-sm"
          style={{ color: s.accent }}
        >
          <Icon className="size-6" aria-hidden="true" />
        </span>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-foreground/60">
          {tCommon("eyebrow", { section: t("name") })}
        </p>
        <h1 className="mt-3 max-w-2xl text-3xl font-bold leading-[1.05] tracking-tight md:text-5xl">
          {t("heroTitle")}
        </h1>
        <p className="mt-4 max-w-2xl leading-relaxed text-foreground/75">
          {t("heroText")}
        </p>
      </section>

      {/* Sub-sections (capstone doc taxonomy) */}
      <section aria-labelledby={`subs-${id}`} className="mt-10">
        <h2
          id={`subs-${id}`}
          className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground"
        >
          {tCommon("subTitle")}
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {subs.map((sub) => {
            const SubIcon = sub.icon;
            return (
              <li key={sub.id}>
                <Card className="h-full py-5 transition-colors hover:border-foreground/25">
                  <CardContent className="flex items-center gap-3">
                    <span
                      className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl"
                      style={{ backgroundColor: s.tint, color: s.accent }}
                    >
                      <SubIcon className="size-5" aria-hidden="true" />
                    </span>
                    <h3 className="font-medium leading-tight">
                      {t(`subs.${sub.id}`)}
                    </h3>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Sample content */}
      <section aria-labelledby={`items-${id}`} className="mt-10">
        <h2
          id={`items-${id}`}
          className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground"
        >
          {tCommon("itemsTitle")}
        </h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2">
          {items.map((item, i) => (
            <li key={i}>
              <Card className="h-full gap-4 py-6 transition-colors hover:border-foreground/25">
                <CardContent className="flex h-full flex-col">
                  <Badge
                    variant="secondary"
                    className="w-fit gap-1.5 px-2.5 py-1 text-xs"
                    style={{ backgroundColor: s.tint, color: s.accent }}
                  >
                    {t(`subs.${item.sub}`)}
                  </Badge>
                  <h3 className="mt-3 font-semibold leading-snug">
                    {t(`items.${i}.title`)}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {t(`items.${i}.desc`)}
                  </p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      {/* CTA strip */}
      <section className="mt-12">
        <div className="relative overflow-hidden rounded-3xl bg-foreground p-8 text-center text-background md:p-12">
          <div
            aria-hidden="true"
            className="pl-glow absolute -right-16 -top-16 size-56 rounded-full opacity-30 blur-[90px]"
            style={{ backgroundColor: s.accent }}
          />
          <div className="relative">
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
              {t("ctaTitle")}
            </h2>
            <p className="mx-auto mt-3 max-w-md text-background/75">
              {t("ctaText")}
            </p>
            <div className="mt-8 flex justify-center">
              <StartCta variant="secondary" />
            </div>
          </div>
        </div>
      </section>

      {/* Back to home */}
      <div className="mt-8 flex justify-center">
        <Button
          asChild
          variant="ghost"
          size="lg"
          className="rounded-full border border-border/70"
        >
          <Link href="/home">
            {tCommon("backHome")}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </PageShell>
  );
}
