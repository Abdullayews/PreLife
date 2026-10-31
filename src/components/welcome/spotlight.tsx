import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HeroGallery } from "@/components/sections/hero-gallery";
import { StartCta } from "@/components/welcome/start-cta";
import { capstoneSections } from "@/lib/capstone";
import { gymHeroImage } from "@/lib/content/gym";
import { dietHeroImage } from "@/lib/content/diet";
import { meditationHeroImage } from "@/lib/content/meditation";
import { libraryHeroImage } from "@/lib/content/library";

/**
 * Landing hero — BetterMe-store-style. The fold is a full-bleed picture
 * switcher (min-h-[88svh], the same scale as the module tabs): the four
 * module worlds rotate behind the Warm Bone / Espresso Night scrims, so
 * "One platform, four worlds" is literally what the background cycles
 * through. The copy sits straight on the scrimmed photo — no panel, no
 * border, just the words — anchored to the SAME left edge the nav bar's
 * content uses (px-4 / sm:px-6, one chrome gutter shared by both) and
 * lifted clear of the bottom band where the switcher's centered dot pill
 * lives (pb-24 while the CTA row can wrap below xl, pb-16 from xl up —
 * never flush). Scrims and ink come from the shared --hero-* /
 * --on-hero-* tokens (.pl-theme-welcome), so the whole hero re-tints
 * when the theme toggle flips .dark.
 */

/* Frame one is the four-worlds still life (the landing banner); then one
   signature frame per module world, reusing each module's hero photo and
   its tuned background-position. */
const HERO_FRAMES = [
  { src: "/img/banner.png", position: "center" },
  { src: gymHeroImage, position: "center 35%" },
  { src: dietHeroImage, position: "center 62%" },
  { src: meditationHeroImage, position: "center 38%" },
  { src: libraryHeroImage, position: "center 45%" },
] as const;

export async function Spotlight() {
  const t = await getTranslations("welcomePage.hero");
  const tc = await getTranslations("moduleCommon");

  return (
    <section
      aria-label={t("ariaLabel")}
      className="relative isolate overflow-hidden"
    >
      {/* Picture switcher — the four worlds rotate behind the scrims.
          Dots-only liquid pill, centered on the fold's bottom band. */}
      <HeroGallery
        images={HERO_FRAMES.map((frame) => frame.src)}
        positions={HERO_FRAMES.map((frame) => frame.position)}
        label={tc("galleryLabel")}
      />

      {/* Scrims are shared classes (.pl-hero-*) fed by --hero-* tokens,
          so the whole hero re-tints when the dark toggle flips .dark —
          the same system the module heroes use. */}
      <div aria-hidden className="pl-hero-side absolute inset-0 -z-10" />
      <div aria-hidden className="pl-hero-fade absolute inset-0 -z-10" />
      <div
        aria-hidden
        className="pl-hero-glow absolute inset-x-0 bottom-0 -z-10 h-[45%]"
      />

      {/* Copy: no panel — the words sit straight on the scrimmed photo,
          aligned to the nav bar's left edge (one chrome gutter) and lifted
          clear of the bottom band the centered dot pill lives in. */}
      <div className="flex min-h-[88svh] w-full flex-col justify-end px-4 pb-24 pt-28 md:px-6 xl:pb-16">
        <div className="max-w-xl">
          <p
            className="pl-slide-up pl-d2 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.3em]"
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
            className="pl-display pl-slide-up pl-d3 mt-4 text-balance text-4xl font-black leading-10 tracking-[-0.02em] sm:text-5xl sm:leading-[52px] md:text-6xl md:leading-[64px]"
            style={{ color: "var(--on-hero)" }}
          >
            {t("title")}
          </h1>
          <p
            className="pl-slide-up pl-d4 mt-4 max-w-md text-sm leading-6 md:text-base md:leading-relaxed"
            style={{ color: "var(--on-hero-muted)" }}
          >
            {t("subtitle")}
          </p>

          {/* Function chips: the four capstone sections — opaque token
              fills, so the module accents stay true on the glass. */}
          <div className="pl-slide-up pl-d5 mt-5 flex flex-wrap items-center gap-2">
            {capstoneSections.map((s) => {
              const Icon = s.icon;
              return (
                <Badge
                  key={s.id}
                  variant="secondary"
                  className="h-7 gap-1.5 px-3 text-xs sm:h-8 sm:text-sm"
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

          {/* CTAs share one even width (min-w-56) so the pair reads as a
              matched set when they stack on narrow screens. */}
          <div className="pl-slide-up pl-d5 mt-7 flex flex-wrap items-center gap-3">
            <StartCta className="h-12 min-w-56 rounded-full px-8 text-base font-semibold hover:brightness-110" />
            <Button
              asChild
              variant="ghost"
              size="lg"
              className="pl-hero-ghost h-12 min-w-56 rounded-full border px-7 text-base font-medium transition-colors"
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
      </div>
    </section>
  );
}
