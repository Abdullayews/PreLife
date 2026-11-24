import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  ArrowRight,
  BadgeCheck,
  ChevronDown,
  Compass,
  Check,
  TrendingUp,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Gallery } from "@/components/Gallery";
import { StartButton } from "@/components/StartButton";
import { AiChatFab } from "@/components/AiChatFab";
import { sections } from "@/lib/shell";
import { getSubscriptionContent, getWorlds } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";

type Props = { params: Promise<{ locale: string }> };
/** The three "you can" bullets on each module card. */
const POINTS = [1, 2, 3] as const;
/** The three "how it works" steps, in order. */
const STEP_KEYS = ["one", "two", "three"] as const;
const STEP_ICONS: readonly LucideIcon[] = [UserPlus, Compass, TrendingUp];
/** FAQ entries live under welcomePage.faq.items.q1..q5. */
const FAQ_KEYS = ["q1", "q2", "q3", "q4", "q5"] as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return { title: t("welcomeTitle"), description: t("welcomeDescription") };
}

/**
 * The public landing page. v6 (pro-site-craft): the full conversion
 * arc — hero (value + specific CTA + honest proof line) → the four
 * worlds → how it works (3 steps) → pricing preview (3 tiers from the
 * same API /subscription reads) → FAQ → closing CTA. Early access
 * means no fake counters: every trust signal on the page is a fact.
 */
export default async function WelcomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "welcomePage" });
  const tc = await getTranslations({ locale, namespace: "moduleCommon" });
  const ts = await getTranslations({ locale, namespace: "subscription" });
  // Signed-in visitors are welcome here too — no forced redirect anymore.
  const [user, worldsData, subData] = await Promise.all([
    getSessionUser(),
    getWorlds(),
    getSubscriptionContent(),
  ]);
  const landingFrames = worldsData?.landingFrames ?? [];
  const tiers = subData?.tiers ?? [];

  return (
    <div data-world="shell" className="world">
      {/* Guests meet the AI assistant here; signed-in visitors get the
       * global FAB from the [locale] layout on every page instead. */}
      {!user && <AiChatFab />}
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
              <StartButton className="btn btn-lg" signedIn={!!user} label={t("hero.start")} />
              <a className="btn btn-lg btn-ghost" href="#modules">{t("hero.seeAll")}</a>
            </div>
            {/* v6: the honest proof line — what is true TODAY, no invented
             * counters (early access). Sits right under the actions. */}
            <p className="hero-proof rise d3">
              <BadgeCheck size={16} aria-hidden />
              {t("hero.proof")}
            </p>
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

      {/* v6: how it works — three steps, numbered, one breath each. */}
      <section id="how" className="sec" aria-label={t("steps.title")}>
        <div className="wrap">
          <header className="head rv">
            <p className="eyebrow">{t("steps.eyebrow")}</p>
            <h2 className="h2">{t("steps.title")}</h2>
          </header>
          <ol className="steps">
            {STEP_KEYS.map((key, i) => {
              const Icon = STEP_ICONS[i]!;
              return (
                <li key={key} className="rv">
                  <div className="step-top">
                    <span className="chip-ico tinted"><Icon size={20} aria-hidden /></span>
                    <span className="step-num" aria-hidden>{String(i + 1).padStart(2, "0")}</span>
                  </div>
                  <h3>{t(`steps.items.${key}.title`)}</h3>
                  <p>{t(`steps.items.${key}.text`)}</p>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* v6: pricing preview — the same server data /subscription renders,
       * compressed to three cards. The middle tier (pro) carries the
       * best-value emphasis; every card states the early-access truth. */}
      {tiers.length > 0 && (
        <section id="pricing" className="sec sec-tint" aria-label={t("pricing.title")}>
          <div className="wrap">
            <header className="head rv">
              <p className="eyebrow">{t("pricing.eyebrow")}</p>
              <h2 className="h2">{t("pricing.title")}</h2>
              <p className="lede">{t("pricing.subtitle")}</p>
            </header>
            <ul className="tiers">
              {tiers.map((tier) => {
                const hot = tier.id === "pro";
                return (
                  <li key={tier.id} className="rv">
                    <div className={hot ? "tier tier-hot" : "tier"}>
                      {hot && <span className="tag tag-solid tier-badge">{ts("bestValue")}</span>}
                      <h3>{ts(`plans.${tier.id}.name`)}</h3>
                      <p className="tier-price">
                        <b>0 ₼</b>
                        <span>{tier.price} ₼ / {ts("perMonth")}</span>
                      </p>
                      <span className="tag tier-free">{t("pricing.freeNow")}</span>
                      <ul className="tier-feats">
                        {tier.features.map((f) => (
                          <li key={f}><Check size={14} aria-hidden />{ts(`feat.${f}`)}</li>
                        ))}
                      </ul>
                      <Link
                        href="/subscription"
                        className={hot ? "btn" : "btn btn-ghost"}
                        aria-label={`${t("pricing.cta")} — ${ts(`plans.${tier.id}.name`)}`}
                      >
                        {t("pricing.cta")}
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="note center">{t("pricing.note")}</p>
          </div>
        </section>
      )}

      {/* v6: FAQ — native details/summary accordions (keyboard- and
       * screen-reader-ready with zero JS). First item opens by default. */}
      <section id="faq" className="sec" aria-label={t("faq.title")}>
        <div className="wrap wrap-faq">
          <header className="head rv">
            <p className="eyebrow">{t("faq.eyebrow")}</p>
            <h2 className="h2">{t("faq.title")}</h2>
          </header>
          <div className="faq">
            {FAQ_KEYS.map((key, i) => (
              <details key={key} className="faq-item rv" open={i === 0}>
                <summary>
                  <span>{t(`faq.items.${key}.q`)}</span>
                  <ChevronDown size={18} aria-hidden />
                </summary>
                <p>{t(`faq.items.${key}.a`)}</p>
              </details>
            ))}
          </div>
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
