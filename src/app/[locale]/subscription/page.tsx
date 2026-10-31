import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Check, Crown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/sections/page-shell";

const PLANS = ["monthly", "yearly", "family"] as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "subscription" });
  return { title: t("title"), description: t("text") };
}

export default async function SubscriptionPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "subscription" });

  return (
    <PageShell pageId="subscription">
      {/* Hero */}
      <section className="mt-6 text-center">
        <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-foreground text-background">
          <Crown className="size-6" aria-hidden="true" />
        </span>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {t("eyebrow")}
        </p>
        <h1 className="mx-auto mt-3 max-w-2xl text-3xl font-bold leading-[1.05] tracking-tight md:text-5xl">
          {t("title")}
        </h1>
        <p className="mx-auto mt-4 max-w-xl leading-relaxed text-muted-foreground">
          {t("text")}
        </p>
      </section>

      {/* Plans — Abonelik (Ödeniş arrives later; nothing is charged here) */}
      <section aria-labelledby="plans-heading" className="mt-12">
        <h2 id="plans-heading" className="sr-only">
          {t("title")}
        </h2>
        <ul className="grid gap-4 md:grid-cols-3">
          {PLANS.map((plan) => {
            const featured = plan === "yearly";
            return (
              <li key={plan} className="h-full">
                <Card
                  className="relative h-full gap-4 py-8"
                  style={
                    featured
                      ? { borderColor: "#7B2D3B", borderWidth: 2 }
                      : undefined
                  }
                >
                  {featured && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 text-white" style={{ backgroundColor: "#7B2D3B" }}>
                      {t("bestValue")}
                    </Badge>
                  )}
                  <CardContent className="flex h-full flex-col text-center">
                    <h3 className="font-semibold">{t(`plans.${plan}.name`)}</h3>
                    <p className="mt-3 text-3xl font-bold tracking-tight">
                      {t(`plans.${plan}.price`)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t(`plans.${plan}.per`)}
                    </p>
                    <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                      {t(`plans.${plan}.desc`)}
                    </p>
                    <ul className="mt-6 flex flex-col gap-2.5 text-left text-sm">
                      {[1, 2, 3].map((n) => (
                        <li key={n} className="flex items-start gap-2">
                          <Check
                            className="mt-0.5 size-4 shrink-0"
                            style={{ color: "#5F7F52" }}
                            aria-hidden="true"
                          />
                          {t(`plans.${plan}.features.${n}`)}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-auto flex justify-center pt-8">
                      <Button
                        className="rounded-full px-6"
                        variant={featured ? "default" : "outline"}
                        style={
                          featured
                            ? { backgroundColor: "#7B2D3B", color: "#FFFFFF" }
                            : undefined
                        }
                        disabled
                        aria-disabled="true"
                      >
                        {t("choose")}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          {t("note")}
        </p>
      </section>
    </PageShell>
  );
}
