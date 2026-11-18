import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Gallery } from "@/components/Gallery";
import { StartButton } from "@/components/StartButton";
import { AiChatFab } from "@/components/AiChatFab";
import { sections } from "@/lib/shell";
import { landingFrames } from "@/lib/worlds";
import { getSessionUser } from "@/lib/auth";

type Props = { params: Promise<{ locale: string }> };
/** The three "you can" bullets on each module card. */
const POINTS = [1, 2, 3] as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return { title: t("welcomeTitle"), description: t("welcomeDescription") };
}

/**
 * The public landing page. v1.3: no stats walls, no manifesto — the page
 * states what the platform is, shows what you can DO in each of the four
 * sections, and invites you to start. That's it.
 */
export default async function WelcomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "welcomePage" });
  const tc = await getTranslations({ locale, namespace: "moduleCommon" });
  // Signed-in visitors are welcome here too — no forced redirect anymore.
  const user = await getSessionUser();

  return (
    <div data-world="shell" className="world">
      <AiChatFab />
      <section className="hero" aria-label={t("hero.ariaLabel")}>
        <Gallery
          images={landingFrames.map((f) => f.src)}
          positions={landingFrames.map((f) => f.pos)}
          label={tc("galleryLabel")}
        />
        <div className="hero-scrim" aria-hidden />
        <div className="wrap hero-body">
          <div className="hero-copy">
            <p className="eyebrow rise"><i />{t("hero.eyebrow")}</p>
            <h1 className="display rise d1">{t("hero.title")}</h1>
            <p className="lede rise d2">{t("hero.subtitle")}</p>
            <div className="actions rise d3">
              <StartButton className="btn btn-lg" signedIn={!!user} />
              <a className="btn btn-lg btn-ghost" href="#modules">{t("hero.seeAll")}</a>
            </div>
            <ul className="chips rise d3">
              {sections.map((s) => (
                <li key={s.id}>
                  <Link href={s.welcomeHref}><s.icon size={14} aria-hidden />{t(`hero.chips.${s.id}`)}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section id="modules" className="sec sec-tint">
        <div className="wrap">
          <header className="head rv">
            <p className="eyebrow">{t("modules.eyebrow")}</p>
            <h2 className="h2">{t("modules.title")}</h2>
            <p className="lede">{t("modules.subtitle")}</p>
          </header>
          <ul className="cards4">
            {sections.map((s) => (
              <li key={s.id} className="rv">
                <Link href={s.welcomeHref} className="card" style={{ "--c": s.color } as React.CSSProperties}>
                  <span className="chip-ico tinted"><s.icon size={20} aria-hidden /></span>
                  <h3>{t(`modules.cards.${s.id}.name`)}</h3>
                  <ul className="card-points">
                    {POINTS.map((n) => (
                      <li key={n}>{t(`modules.cards.${s.id}.point${n}`)}</li>
                    ))}
                  </ul>
                  <em>{t("modules.explore")}<ArrowRight size={15} aria-hidden /></em>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="get-started" className="sec">
        <div className="wrap">
          <div className="cta rv">
            <h2 className="h2">{t("cta.title")}</h2>
            <p>{t("cta.text")}</p>
            <StartButton className="btn btn-lg btn-light" signedIn={!!user} />
            <small>{t("cta.note")}</small>
          </div>
        </div>
      </section>
    </div>
  );
}
