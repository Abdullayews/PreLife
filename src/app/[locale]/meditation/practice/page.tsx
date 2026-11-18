import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
  ArrowLeft, BedDouble, Brain, Compass, HeartPulse, Timer, Wind,
} from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { MEDIA } from "@/lib/psychology";
import { AudioPlayerCard } from "@/components/psych/AudioPlayerCard";
import { VideoCard } from "@/components/psych/VideoCard";
import { PsychShell } from "@/components/psych/PsychShell";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "psychApp" });
  return { title: t("practiceMetaTitle"), description: t("practiceMetaDescription") };
}

export default async function PracticePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "psychApp" });
  const user = await requireUser(locale, "/meditation/practice");

  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const progress = await db.meditationProgress.aggregate({
    where: { userId: user.id, createdAt: { gte: weekAgo } },
    _sum: { seconds: true },
  });
  const minutesThisWeek = Math.round((progress._sum.seconds ?? 0) / 60);

  const audio = MEDIA.filter((m) => m.kind === "audio");
  const video = MEDIA.filter((m) => m.kind === "video");
  const BENEFITS: { icon: typeof Brain; key: string }[] = [
    { icon: Brain, key: "benefit1" },
    { icon: Wind, key: "benefit2" },
    { icon: BedDouble, key: "benefit3" },
    { icon: HeartPulse, key: "benefit4" },
    { icon: Timer, key: "benefit5" },
    { icon: Compass, key: "benefit6" },
  ];

  return (
    <PsychShell locale={locale} active="practice">
      <div className="wrap">
        <header className="page-head">
          <p className="eyebrow"><i /><Link href="/diet" className="backlink"><ArrowLeft size={14} aria-hidden /></Link>{t("practiceEyebrow")}</p>
          <h1 className="display sm">{t("practiceTitle")}</h1>
          <p className="lede">{t("practiceSubtitle")}</p>
        </header>

        <section aria-labelledby="what-h" className="blk">
          <h2 id="what-h" className="eyebrow"><b>01</b>{t("whatEyebrow")}</h2>
          <div className="card">
            <p>{t("whatText")}</p>
          </div>
        </section>

        <section aria-labelledby="benefits-h" className="blk">
          <h2 id="benefits-h" className="eyebrow"><b>02</b>{t("benefitsEyebrow")}</h2>
          <ul className="why">
            {BENEFITS.map(({ icon: Icon, key }) => (
              <li key={key}>
                <Icon size={22} aria-hidden />
                <h3>{t(`${key}Title`)}</h3>
                <p>{t(`${key}Desc`)}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="audio-h" className="blk">
          <h2 id="audio-h" className="eyebrow"><b>03</b>{t("audioEyebrow")}</h2>
          <p className="lede">{t("audioIntro")}</p>
          <ul className="cards2" style={{ marginTop: "1rem" }}>
            {audio.map((m) => (
              <li key={m.id}>
                <AudioPlayerCard id={m.id} src={m.src} title={t(m.titleKey)} desc={`${t(m.descKey)} · ${m.minutes} min`} />
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="video-h" className="blk">
          <h2 id="video-h" className="eyebrow"><b>04</b>{t("videoEyebrow")}</h2>
          <p className="lede">{t("videoIntro")}</p>
          <ul className="media-row" style={{ marginTop: "1rem" }}>
            {video.map((m) => (
              <li key={m.id}>
                <VideoCard id={m.id} src={m.src} poster={m.poster} title={t(m.titleKey)} desc={`${t(m.descKey)} · ${m.minutes} min`} />
              </li>
            ))}
          </ul>
        </section>

        <section aria-label={t("statsEyebrow")} className="blk">
          <dl className="mini-stats">
            <div className="mini-stat"><dt>{t("statMinutes")}</dt><dd>{minutesThisWeek}</dd></div>
          </dl>
        </section>
      </div>
    </PsychShell>
  );
}
