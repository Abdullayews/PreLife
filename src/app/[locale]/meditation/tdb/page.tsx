import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getMeditationContent } from "@/lib/api";
import { VideoCard } from "@/components/psych/VideoCard";
import { PsychShell } from "@/components/psych/PsychShell";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "psychApp" });
  return { title: t("tdbMetaTitle"), description: t("tdbMetaDescription") };
}

export default async function TdbPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "psychApp" });
  await requireUser(locale, "/meditation/tdb");
  const TDB_VIDEOS = (await getMeditationContent())?.tdb ?? [];

  return (
    <PsychShell locale={locale} active="tdb">
      <div className="wrap">
        <header className="page-head">
          <p className="eyebrow">
            <i />
            <Link href="/meditation" className="backlink"><ArrowLeft size={14} aria-hidden /></Link>
            {t("tdbEyebrow")}
          </p>
          <h1 className="display sm">{t("tdbTitle")}</h1>
          <p className="lede">{t("tdbSubtitle")}</p>
        </header>

        <section aria-label={t("tdbIntroEyebrow")} className="blk">
          <div className="card tdb-intro">
            <span className="chip-ico tinted"><Sparkles size={20} aria-hidden /></span>
            <p>{t("tdbIntro")}</p>
          </div>
        </section>

        <section aria-labelledby="tdb-list-h" className="blk">
          <h2 id="tdb-list-h" className="eyebrow"><b>01</b>{t("tdbListEyebrow")}</h2>
          <ul className="media-row tdb-grid">
            {TDB_VIDEOS.map((m) => (
              <li key={m.id}>
                <VideoCard
                  id={m.id}
                  src={m.src}
                  poster={m.poster}
                  title={t(m.titleKey)}
                  desc={`${t(m.descKey)} · ${t("tdbMinutes", { count: m.minutes })}`}
                />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </PsychShell>
  );
}
