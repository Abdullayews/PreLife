import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ArrowLeft, Flame } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getDietContent } from "@/lib/api";
import { ContentUnavailable } from "@/components/ContentUnavailable";
import { DietShell } from "@/components/diet/DietShell";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dietApp" });
  return { title: t("plansTitle"), description: t("plansSubtitle") };
}

/** level keys in dietHome: levelBeginner / levelIntermediate / levelAdvanced. */
const cap = (l: string) => l[0]!.toUpperCase() + l.slice(1);

export default async function DietPlansPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale, "/diet/plans");

  const t = await getTranslations({ locale, namespace: "dietApp" });
  const dietContent = await getDietContent(user.location);
  if (!dietContent) return <ContentUnavailable locale={locale} />;
  const { plans: dietPlans } = dietContent;
  
  return (
    <DietShell locale={locale} active="plans">
      <div className="wrap">
        <header className="page-head">
          <p className="eyebrow">
            <i />
            <Link href="/diet" className="backlink"><ArrowLeft size={14} aria-hidden /></Link>
            {t("rail_plans")}
          </p>
          <h1 className="display sm">{t("plansTitle")}</h1>
          <p className="lede">{t("plansSubtitle")}</p>
        </header>

        <ul className="gshop-grid">
          {dietPlans.map((p) => {
            /* meta rows: [key, count] pairs — days/weeks/meals from
             * worlds.diet, plus the kcal line from the plan's data. */
            const meta = p.meta.map(([key, count]) => t(key, { count }));
            const kcal = meta[meta.length - 1];
            return (
              <li key={p.id} className="card dplan-card">
                <div className="dplan-img">
                  <img src={p.image} alt="" width={800} height={500} loading="lazy" decoding="async" />
                </div>
                <div className="dplan-body">
                  <span className="card-top">
                    <span className="tag">{t(`level${cap(p.level)}`)}</span>
                    {p.featured && <span className="tag tag-solid">{t("plansBadgeFeatured")}</span>}
                  </span>
                  <h3 className="h4">{t(p.nameKey)}</h3>
                  <p>{t(p.descKey)}</p>
                  <ul className="facts">
                    {meta.map((m) => <li key={m}>{m}</li>)}
                  </ul>
                  <p className="dplan-kcal"><Flame size={14} aria-hidden /><b>{kcal}</b></p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </DietShell>
  );
}
