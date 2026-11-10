import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { worlds, type Level } from "@/lib/worlds";
import { requireUser } from "@/lib/auth";

type Props = { params: Promise<{ locale: string }> };
const cap = (l: Level) => `level${l[0].toUpperCase()}${l.slice(1)}`;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "gymHome" });
  return { title: t("metaTitle"), description: t("metaDescription") };
}

/** The base of the new Gym main page — the section grows from here. */
export default async function GymPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUser(locale, "/gym");

  const t = await getTranslations({ locale, namespace: "gymHome" });
  const w = worlds.gym;

  return (
    <div data-world="gym" className="world page">
      <div className="wrap">
        <header className="page-head">
          <p className="eyebrow"><i />{t("heroEyebrow")}</p>
          <h1 className="display sm">{t("heroTitle")}</h1>
          <p className="lede">{t("heroSubtitle")}</p>
        </header>

        <dl className="hero-stats">
          {w.hero.stats.map(([v, l]) => (
            <div key={l}><dd>{t(v)}</dd><dt>{t(l)}</dt></div>
          ))}
        </dl>
      </div>

      {/* ── 01 · Training plans ─────────────────────────────────────── */}
      <section id="plans" className="sec sec-tint">
        <div className="wrap">
          <header className="head rv">
            <p className="eyebrow"><b>01</b>{t("plansEyebrow")}</p>
            <h2 className="h2">{t("plansTitle")}</h2>
            <p className="lede">{t("plansSubtitle")}</p>
          </header>
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

      {/* ── 02 · Exercise library ───────────────────────────────────── */}
      <section id="exercises" className="sec">
        <div className="wrap">
          <header className="head rv">
            <p className="eyebrow"><b>02</b>{t("exercisesEyebrow")}</p>
            <h2 className="h2">{t("exercisesTitle")}</h2>
            <p className="lede">{t("exercisesSubtitle")}</p>
          </header>
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
          <p className="note">{t("baseNote")}</p>
        </div>
      </section>
    </div>
  );
}
