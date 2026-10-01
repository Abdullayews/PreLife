import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StartCta } from "@/components/welcome/start-cta";
import { capstoneSections } from "@/lib/capstone";

/**
 * ani.pm-style spotlight banner (single artwork, compact height) with
 * Ultrahuman-style motion: slow Ken Burns drift + staggered text reveals.
 * CSS keyframes live in welcome-theme.css (no animation libraries).
 */
export async function Spotlight() {
  const t = await getTranslations("welcomePage.hero");

  return (
    <section aria-label={t("ariaLabel")} className="relative">
      <div className="relative h-[480px] overflow-hidden rounded-3xl border sm:h-[500px] lg:h-[560px]">
        {/* Artwork: one pic with the main functions, slow Ken Burns drift */}
        <Image
          src="/img/banner.png"
          alt={t("alt")}
          fill
          priority
          sizes="(min-width: 1152px) 1152px, 100vw"
          className="object-cover pl-kenburns"
        />

        {/* Readability scrims (token-based: flips with the light theme) */}
        <div
          className="absolute inset-0 z-10 bg-gradient-to-r from-background/95 via-background/70 to-transparent"
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 z-10 bg-gradient-to-t from-background/95 via-background/35 to-background/20"
          aria-hidden="true"
        />

        {/* Content: ani.pm spotlight stack (bottom-left) */}
        <div className="relative z-20 flex h-full flex-col justify-end p-6 pb-11 sm:p-10 sm:pb-12 lg:p-14">
          <p className="pl-slide-up pl-d1 text-xs font-semibold uppercase tracking-[0.2em] text-foreground/70">
            {t("eyebrow")}
          </p>
          <h1 className="pl-slide-up pl-d2 mt-4 max-w-2xl text-3xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            {t("title")}
          </h1>
          <p className="pl-slide-up pl-d3 mt-3 line-clamp-4 max-w-xl text-sm font-medium leading-relaxed text-foreground/90 sm:line-clamp-none sm:text-base">
            {t("subtitle")}
          </p>

          {/* Function chips: the four capstone sections (ani.pm meta chips) */}
          <div className="pl-slide-up pl-d4 mt-5 grid w-fit grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            {capstoneSections.map((s) => {
              const Icon = s.icon;
              return (
                <Badge
                  key={s.id}
                  variant="secondary"
                  className="gap-1.5 border border-border/60 bg-background/60 px-2.5 py-1 text-xs text-foreground/90 backdrop-blur-sm sm:px-3 sm:text-sm"
                >
                  <Icon
                    className="size-3.5"
                    style={{ color: s.accent }}
                    aria-hidden="true"
                  />
                  {t(`chips.${s.id}`)}
                </Badge>
              );
            })}
          </div>

          <div className="pl-slide-up pl-d5 mt-7 flex flex-wrap items-center gap-3">
            <StartCta />
            <Button
              asChild
              variant="ghost"
              size="lg"
              className="rounded-full border border-border/70 bg-background/70 text-foreground backdrop-blur-sm hover:bg-background/90"
            >
              <a href="#modules">{t("seeAll")}</a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
