import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { modules, type ModuleSlug } from "@/lib/modules";

type ExploreModulesProps = {
  current: ModuleSlug;
  locale: string;
};

export async function ExploreModules({ current, locale }: ExploreModulesProps) {
  const t = await getTranslations({ locale, namespace: "moduleCommon" });
  const others = modules.filter((mod) => mod.slug !== current);

  return (
    <section className="border-t bg-muted/40">
      <div className="mx-auto max-w-6xl px-4 py-14 md:px-6 md:py-20">
        <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
          {t("exploreTitle")}
        </h2>
        <p className="mt-2 text-muted-foreground">{t("exploreSubtitle")}</p>
        <ul className="mt-8 grid gap-4 sm:grid-cols-3">
          {others.map((mod) => {
            const Icon = mod.icon;
            return (
              <li key={mod.slug} className="h-full">
                <Link
                  href={`/${mod.slug}`}
                  className="group flex h-full flex-col gap-3 rounded-xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <span
                    aria-hidden
                    className="inline-flex size-10 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${mod.accent}1A`, color: mod.accent }}
                  >
                    <Icon className="size-5" />
                  </span>
                  <span className="font-medium">{t(`moduleName_${mod.slug}`)}</span>
                  <span className="text-sm text-muted-foreground">
                    {t(`moduleDesc_${mod.slug}`)}
                  </span>
                  <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium">
                    <span style={{ color: mod.accent }}>{t("exploreCta")}</span>
                    <ArrowRight
                      aria-hidden
                      className="size-4 transition-transform group-hover:translate-x-0.5"
                    />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
