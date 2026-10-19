import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StartCta } from "@/components/welcome/start-cta";
import { capstoneSections } from "@/lib/capstone";

/**
 * Landing hero — the SAME full-bleed photo scale as the module tabs
 * (min-h-[88svh], edge-to-edge). The artwork drifts with a slow,
 * GPU-composited Ken Burns zoom; scrims and ink come from the shared
 * --hero-* / --on-hero-* tokens (.pl-theme-welcome defines the Warm Bone /
 * Espresso Night pair), so the whole hero re-tints when the theme toggle
 * flips .dark. Chips and the ghost button use opaque token fills instead
 * of backdrop-blur: stacking a blur over a moving photo forces a
 * re-filter every frame (that was the zoom's lag).
 */
export async function Spotlight() {
  const t = await getTranslations("welcomePage.hero");

  return (
    <section
      aria-label={t("ariaLabel")}
      className="relative isolate overflow-hidden"
    >
      {/* Artwork: one pic with the main functions, slow Ken Burns drift */}
      <div className="absolute inset-0 -z-20 overflow-hidden">
        <Image
          src="/img/banner.png"
          alt={t("alt")}
          fill
          priority
          sizes="100vw"
          className="object-cover pl-kenburns"
        />
      </div>

      {/* Scrims are shared classes (.pl-hero-*) fed by --hero-* tokens,
          so the whole hero re-tints when the dark toggle flips .dark —
          the same system the module heroes use. */}
      <div aria-hidden className="pl-hero-side absolute inset-0 -z-10" />
      <div aria-hidden className="pl-hero-fade absolute inset-0 -z-10" />
      <div
        aria-hidden
        className="pl-hero-glow absolute inset-x-0 bottom-0 -z-10 h-[45%]"
      />

      {/* Content: module-hero stack (bottom-left) */}
      <div className="mx-auto flex min-h-[88svh] w-full max-w-6xl flex-col justify-end px-4 pb-14 pt-28 md:px-6 md:pb-20">
        <p
          className="pl-slide-up pl-d1 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.3em]"
          style={{ color: "var(--on-hero-muted)" }}
        >
          <span
            aria-hidden
            className="h-px w-10 shrink-0"
            style={{ backgroundColor: "var(--site-accent)" }}
          />
          {t("eyebrow")}
        </p>
        <h1
          className="pl-slide-up pl-d2 pl-display mt-6 max-w-4xl text-5xl font-black leading-[0.98] tracking-[-0.03em] md:text-7xl lg:text-[5.25rem]"
          style={{ color: "var(--on-hero)" }}
        >
          {t("title")}
        </h1>
        <p
          className="pl-slide-up pl-d3 mt-6 max-w-xl text-base leading-relaxed md:text-lg"
          style={{ color: "var(--on-hero-muted)" }}
        >
          {t("subtitle")}
        </p>

        {/* Function chips: the four capstone sections — opaque token fills,
            no backdrop-blur over the moving photo (see note above). */}
        <div className="pl-slide-up pl-d4 mt-6 flex flex-wrap items-center gap-2">
          {capstoneSections.map((s) => {
            const Icon = s.icon;
            return (
              <Badge
                key={s.id}
                variant="secondary"
                className="gap-1.5 px-2.5 py-1 text-xs sm:px-3 sm:text-sm"
                style={{
                  backgroundColor: "var(--on-hero-fill)",
                  borderColor: "var(--on-hero-border)",
                  color: "var(--on-hero)",
                }}
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

        <div className="pl-slide-up pl-d5 mt-9 flex flex-wrap items-center gap-3">
          <StartCta className="h-12 rounded-full px-8 text-base font-semibold hover:brightness-110" />
          <Button
            asChild
            variant="ghost"
            size="lg"
            className="pl-hero-ghost h-12 rounded-full border px-7 text-base font-medium transition-colors"
            style={{
              borderColor: "var(--on-hero-border)",
              backgroundColor: "var(--on-hero-fill)",
              color: "var(--on-hero)",
            }}
          >
            <a href="#modules">{t("seeAll")}</a>
          </Button>
        </div>
      </div>
    </section>
  );
}
