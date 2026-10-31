import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight, Crown } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { RequireActive } from "@/components/Funnel";
import { sections, sectionById, type SectionId } from "@/lib/shell";

type Props = { params: Promise<{ locale: string }> };
const PICKS: { key: string; section: SectionId }[] = [
  { key: "pick1", section: "sport" },
  { key: "pick2", section: "diet" },
  { key: "pick3", section: "psikoloji" },
];

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return { title: t("homeTitle"), description: t("homeDescription") };
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "homePage" });
  const tm = await getTranslations({ locale, namespace: "welcomePage.modules" });

  return (
    <div data-world="shell" className="world page">
      <RequireActive />
      <div className="wrap">
        <header className="page-head">
          <p className="eyebrow">{t("tagline")}</p>
          <h1 className="display sm">{t("title")}</h1>
          <p className="lede">{t("placeholder")}</p>
        </header>

        <section aria-labelledby="today" className="blk">
          <h2 id="today" className="eyebrow">{t("today.eyebrow")}</h2>
          <ul className="cards3">
            {PICKS.map(({ key, section }) => {
              const s = sectionById(section);
              return (
                <li key={key}>
                  <Link href={s.href} className="card" style={{ "--c": s.color } as React.CSSProperties}>
                    <span className="card-top">
                      <span className="chip-ico tinted"><s.icon size={20} aria-hidden /></span>
                      <span className="eyebrow">{tm(`cards.${s.id}.name`)}</span>
                    </span>
                    <h3>{t(`today.${key}.title`)}</h3>
                    <em>{t("today.open")}<ArrowRight size={15} aria-hidden /></em>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby="sections" className="blk">
          <h2 id="sections" className="eyebrow">{t("sectionsEyebrow")}</h2>
          <ul className="cards4">
            {sections.map((s) => (
              <li key={s.id}>
                <Link href={s.href} className="card" style={{ "--c": s.color } as React.CSSProperties}>
                  <span className="chip-ico tinted"><s.icon size={20} aria-hidden /></span>
                  <h3>{tm(`cards.${s.id}.name`)}</h3>
                  <em>{tm("explore")}<ArrowRight size={15} aria-hidden /></em>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="blk">
          <div className="banner">
            <span className="chip-ico solid"><Crown size={20} aria-hidden /></span>
            <div>
              <h2 className="h3">{t("subscription.title")}</h2>
              <p>{t("subscription.text")}</p>
            </div>
            <Link href="/subscription" className="btn">{t("subscription.cta")}</Link>
          </div>
        </section>
      </div>
    </div>
  );
}
