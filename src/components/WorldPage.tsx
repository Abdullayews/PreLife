import { getTranslations } from "next-intl/server";
import { ArrowRight, Star } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { worlds, scheduleDayKeys, type Level, type WorldSlug } from "@/lib/worlds";
import { sections } from "@/lib/shell";
import { Gallery } from "./Gallery";

const cap = (l: Level) => `level${l[0].toUpperCase()}${l.slice(1)}`;

function Head({ n, eyebrow, title, subtitle }: { n: number; eyebrow: string; title: string; subtitle?: string }) {
  return (
    <header className="head rv">
      <p className="eyebrow"><b>{String(n).padStart(2, "0")}</b>{eyebrow}</p>
      <h2 className="h2">{title}</h2>
      {subtitle && <p className="lede">{subtitle}</p>}
    </header>
  );
}

function Stars({ size = 15 }: { size?: number }) {
  return (
    <span className="stars" aria-hidden>
      {Array.from({ length: 5 }, (_, i) => <Star key={i} size={size} fill="currentColor" />)}
    </span>
  );
}

/** One page template for gym, diet, meditation and library. */
export async function WorldPage({ slug, locale }: { slug: WorldSlug; locale: string }) {
  const w = worlds[slug];
  const t = await getTranslations({ locale, namespace: w.ns });
  const tc = await getTranslations({ locale, namespace: "moduleCommon" });
  const marquee = t("marqueeItems").split("\u2022").map((s) => s.trim()).filter(Boolean);
  let n = 0;

  return (
    <div data-world={slug} className="world">
      {/* ── Hero ─────────────────────────────── */}
      <section id="top" className="hero">
        <Gallery images={w.hero.images} positions={w.hero.positions} label={tc("galleryLabel")} />
        <div className="hero-scrim" aria-hidden />
        <div className="wrap hero-body">
          <div className="hero-copy">
            <p className="eyebrow rise"><i />{t("heroEyebrow")}</p>
            <h1 className="display rise d1">{t("heroTitle")}</h1>
            <p className="lede rise d2">{t("heroSubtitle")}</p>
            <p className="rating rise d2"><Stars /><span>{t("heroRating")}</span></p>
            <div className="actions rise d3">
              <a className="btn btn-lg" href={`#${w.ids.plans}`}>{t("heroCtaPrimary")}</a>
              <a className="btn btn-lg btn-ghost" href={`#${w.ids.places}`}>{t("heroCtaSecondary")}</a>
            </div>
          </div>
          <dl className="hero-stats rise d3">
            {w.hero.stats.map(([v, l]) => (
              <div key={l}><dd>{t(v)}</dd><dt>{t(l)}</dt></div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── Marquee ──────────────────────────── */}
      <div className="marquee" aria-label={marquee.join(", ")}>
        <div className="marquee-track">
          {[0, 1].map((copy) => (
            <ul key={copy} aria-hidden="true">
              {marquee.map((word) => <li key={word}>{word}</li>)}
            </ul>
          ))}
        </div>
      </div>

      {/* ── Why ──────────────────────────────── */}
      <section id="why" className="sec">
        <div className="wrap">
          <Head n={++n} eyebrow={t("whyEyebrow")} title={t("whyTitle")} subtitle={t("whySubtitle")} />
          <ul className="why">
            {w.featureIcons.map((Icon, i) => (
              <li key={i} className="rv">
                <Icon size={22} aria-hidden />
                <h3>{t(`why${i + 1}Title`)}</h3>
                <p>{t(`why${i + 1}Desc`)}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Plans ────────────────────────────── */}
      <section id={w.ids.plans} className="sec sec-tint">
        <div className="wrap">
          <Head n={++n} eyebrow={t("plansEyebrow")} title={t("plansTitle")} subtitle={t("plansSubtitle")} />
          <ul className="plans">
            {w.plans.map((p) => (
              <li key={p.id} className="plan rv" data-featured={p.featured ? "" : undefined}>
                <div className="plan-img">
                  <img src={p.image} alt="" loading="lazy" decoding="async" />
                  {p.featured && <span className="tag tag-solid">{t("plansMostPopular")}</span>}
                </div>
                <div className="plan-body">
                  <span className="tag">{t(cap(p.level))}</span>
                  <h3>{t(p.nameKey)}</h3>
                  <p>{t(p.descKey)}</p>
                  <ul className="facts">
                    {p.meta.map(([key, count]) => <li key={key}>{t(key, { count })}</li>)}
                  </ul>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Items (exercises / recipes / sessions / books) ── */}
      <section id={w.ids.items} className="sec">
        <div className="wrap">
          <Head n={++n} eyebrow={t(`${w.prefix.items}Eyebrow`)} title={t(`${w.prefix.items}Title`)} subtitle={t(`${w.prefix.items}Subtitle`)} />
          <ul className="items">
            {w.items.map(({ id, icon: Icon, nameKey, targetKey, level }) => (
              <li key={id} className="item rv">
                <span className="chip-ico"><Icon size={20} aria-hidden /></span>
                <div>
                  <h3>{t(nameKey)}</h3>
                  <p>{t(targetKey)}</p>
                </div>
                <span className="tag">{t(cap(level))}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Schedule ─────────────────────────── */}
      <section id="schedule" className="sec sec-tint">
        <div className="wrap">
          <Head n={++n} eyebrow={t("scheduleEyebrow")} title={t("scheduleTitle")} subtitle={t("scheduleSubtitle")} />
          <div className="sched-wrap rv" tabIndex={0}>
            <table className="sched">
              <thead>
                <tr>
                  <th scope="col">{t("scheduleTime")}</th>
                  {scheduleDayKeys.map((d) => <th key={d} scope="col">{t(d)}</th>)}
                </tr>
              </thead>
              <tbody>
                {w.schedule.slots.map((slot) => (
                  <tr key={slot.time}>
                    <th scope="row"><b>{slot.time}</b><span>{t(slot.labelKey)}</span></th>
                    {slot.cells.map((cell, i) => (
                      <td key={i}>
                        <span className="cell" data-kind={Object.keys(w.schedule.cellKeys).indexOf(cell)}>
                          {t(w.schedule.cellKeys[cell])}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="note">{t("scheduleRestNote")}</p>
        </div>
      </section>

      {/* ── Stories ──────────────────────────── */}
      <section id="stories" className="sec">
        <div className="wrap">
          <Head n={++n} eyebrow={t("storiesEyebrow")} title={t("storiesTitle")} />
          <ul className="stories">
            {w.initials.map((ini, i) => (
              <li key={ini} className="rv">
                <figure>
                  <blockquote>{"\u201C"}{t(`stories${i + 1}Quote`)}{"\u201D"}</blockquote>
                  <figcaption>
                    <span className="avatar" aria-hidden>{ini}</span>
                    <span><b>{t(`stories${i + 1}Name`)}</b><small>{t(`stories${i + 1}Role`)}</small></span>
                  </figcaption>
                </figure>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Places (gyms / venues / mentors) ─── */}
      <section id={w.ids.places} className="sec sec-tint">
        <div className="wrap">
          <Head n={++n} eyebrow={t(`${w.prefix.places}Eyebrow`)} title={t(`${w.prefix.places}Title`)} subtitle={t(`${w.prefix.places}Subtitle`)} />
          <ul className="places">
            {w.places.map((p) => (
              <li key={p.id} className="place rv">
                <img src={p.image} alt="" loading="lazy" decoding="async" />
                <div>
                  <div className="place-top">
                    <h3>{t(p.nameKey)}</h3>
                    <span className="score" role="img" aria-label={t(`${w.prefix.places}RatingA11y`, { score: p.rating })}>
                      <Star size={14} fill="currentColor" aria-hidden />{p.rating.toFixed(1)}
                    </span>
                  </div>
                  <p>{t(p.descKey)}</p>
                  <ul className="chips">
                    {p.featureKeys.map((k) => <li key={k}>{t(k)}</li>)}
                  </ul>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Closing CTA ──────────────────────── */}
      <section className="sec">
        <div className="wrap">
          <div className="cta rv">
            <h2 className="h2">{t("ctaTitle")}</h2>
            <p>{t("ctaSubtitle")}</p>
            <a className="btn btn-lg btn-light" href="#top">{t("ctaButton")}</a>
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
                <Link href={s.href}>
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
