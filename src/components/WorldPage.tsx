import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getWorlds } from "@/lib/api";
import { iconByName } from "@/lib/icons";
import type { WorldSlug } from "@/lib/worlds";
import { sections } from "@/lib/shell";
import { getSessionUser } from "@/lib/auth";
import { Gallery } from "./Gallery";
import { StartButton } from "./StartButton";

/**
 * The PUBLIC page for one content world (gym, diet, meditation, library) —
 * served at /welcome/<slug> for every visitor, no account needed.
 *
 * v1.3: this surface is deliberately minimal. Visitors are not here to read
 * marketing — the page answers ONE question: "what can I do in this section?"
 * A slim hero, the capability list (mirroring the registered app's tabs),
 * the start CTA and cross-links to the other worlds. Everything else
 * (plans, schedules, stories, venue directories) lives inside the app,
 * where it belongs.
 */
export async function WorldPage({ slug, locale }: { slug: WorldSlug; locale: string }) {
  // The world's content (hero, canDo cards) comes from the Rust API.
  const data = (await getWorlds())!;
  const w = data.worlds[slug];
  const [t, tc, user] = await Promise.all([
    getTranslations({ locale, namespace: w.ns }),
    getTranslations({ locale, namespace: "moduleCommon" }),
    getSessionUser(),
  ]);
  const signedIn = !!user;

  return (
    <div data-world={slug} className="world">
      {/* ── Hero ─────────────────────────────── */}
      <section id="top" className="hero">
        <Gallery
          images={w.hero.images}
          positions={w.hero.positions}
          label={tc("galleryLabel")}
        />
        <div className="hero-scrim" aria-hidden />
        <div className="wrap hero-body">
          <div className="hero-copy">
            <p className="eyebrow rise"><i />{t("heroEyebrow")}</p>
            <h1 className="display rise d1">{t("heroTitle")}</h1>
            <p className="lede rise d2">{t("heroSubtitle")}</p>
            <div className="actions rise d3">
              <StartButton className="btn btn-lg" signedIn={signedIn} />
              <a className="btn btn-lg btn-ghost" href="#can">{t("canCta")}</a>
            </div>
          </div>
        </div>
      </section>

      {/* ── What you can do ──────────────────── */}
      <section id="can" className="sec sec-tint">
        <div className="wrap">
          <header className="head rv">
            <p className="eyebrow">{t("canEyebrow")}</p>
            <h2 className="h2">{t("canTitle")}</h2>
            <p className="lede">{t("canSubtitle")}</p>
          </header>
          <ul className="can">
            {w.canDo.map((c, i) => {
              const CanIcon = iconByName(c.icon);
              return (
                <li key={i} className="rv">
                  <span className="chip-ico tinted"><CanIcon size={20} aria-hidden /></span>
                  <h3>{t(c.titleKey)}</h3>
                  <p>{t(c.descKey)}</p>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* ── Closing CTA ──────────────────────── */}
      <section className="sec">
        <div className="wrap">
          <div className="cta rv">
            <h2 className="h2">{t("ctaTitle")}</h2>
            <p>{t("ctaSubtitle")}</p>
            <StartButton className="btn btn-lg btn-light" signedIn={signedIn} label={t("ctaButton")} />
            <small>{t("ctaNote")}</small>
          </div>
        </div>
      </section>

      {/* ── Explore the other worlds ─────────── */}
      <section className="sec sec-tint explore">
        <div className="wrap">
          <h2 className="h3">{tc("exploreTitle")}</h2>
          <p className="lede">{tc("exploreSubtitle")}</p>
          <ul>
            {sections.filter((s) => s.slug !== slug).map((s) => (
              <li key={s.slug}>
                <Link href={s.welcomeHref}>
                  <s.icon size={20} aria-hidden />
                  <b>{tc(`moduleName_${s.slug}`)}</b>
                  <span>{tc(`moduleDesc_${s.slug}`)}</span>
                  <em>{tc("exploreCta")}<ArrowRight size={15} aria-hidden /></em>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
