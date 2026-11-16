import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { QUIZZES, bakuParts } from "@/lib/psychology";
import { MoodCheck } from "@/components/psychology/MoodCheck";
import { QuizCard } from "@/components/psychology/QuizCard";
import { MoodCharts } from "@/components/psychology/MoodCharts";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meditationApp" });
  return { title: t("moodMetaTitle"), description: t("moodMetaDescription") };
}

export default async function MoodPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "meditationApp" });
  const user = await requireUser(locale, "/meditation/mood");

  const logs = await db.moodLog.findMany({
    where: { userId: user.id },
    orderBy: { date: "asc" },
    take: 60,
  });
  const today = bakuParts(new Date()).date;
  const todayLog = logs.findLast((l) => l.date === today) ?? null;

  const quizRows = await db.quizResult.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 6,
  });

  // Pre-translated quiz labels for the client component.
  const labels = Object.fromEntries(
    QUIZZES.map((q) => [
      q.id,
      {
        title: t(`quiz_${q.id}_title`),
        desc: t(`quiz_${q.id}_desc`),
        questions: Array.from({ length: 3 }, (_, qi) => ({
          q: t(`quiz_${q.id}_q${qi + 1}`),
          opts: [1, 2, 3, 4].map((oi) => t(`quiz_${q.id}_q${qi + 1}o${oi}`)),
        })),
      },
    ]),
  );

  const fmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <div data-world="meditation" className="world page">
      <div className="wrap">
        <header className="page-head">
          <p className="eyebrow"><i /><Link href="/meditation" className="backlink"><ArrowLeft size={14} aria-hidden /></Link>{t("moodPageEyebrow")}</p>
          <h1 className="display sm">{t("moodPageTitle")}</h1>
          <p className="lede">{t("moodPageSubtitle")}</p>
        </header>

        <section aria-labelledby="check-h" className="blk">
          <h2 id="check-h" className="eyebrow"><b>01</b>{t("moodEyebrow")}</h2>
          <div className="card">
            <MoodCheck
              initial={todayLog
                ? { mood: todayLog.mood, energy: todayLog.energy, sleepQ: todayLog.sleepQ, tags: todayLog.tags ? todayLog.tags.split(",") : [], note: todayLog.note ?? "" }
                : null}
            />
          </div>
        </section>

        <section aria-labelledby="quiz-h" className="blk">
          <h2 id="quiz-h" className="eyebrow"><b>02</b>{t("quizEyebrow")}</h2>
          <QuizCard
            labels={labels}
            zones={{ low: t("quizZoneLow"), mid: t("quizZoneMid"), high: t("quizZoneHigh") }}
          />
        </section>

        <section aria-labelledby="charts-h" className="blk">
          <h2 id="charts-h" className="eyebrow"><b>03</b>{t("chartsEyebrow")}</h2>
          <MoodCharts logs={logs.map((l) => ({ date: l.date, mood: l.mood, energy: l.energy, sleepQ: l.sleepQ, tags: l.tags }))} locale={locale} />
        </section>

        {quizRows.length > 0 && (
          <section aria-labelledby="quizhist-h" className="blk">
            <h2 id="quizhist-h" className="eyebrow"><b>04</b>{t("quizHistory")}</h2>
            <div className="bk-scroll">
              <table className="bk-table">
                <thead>
                  <tr>
                    <th scope="col">{t("colWhen")}</th>
                    <th scope="col">{t("quizColQuiz")}</th>
                    <th scope="col">{t("quizColScore")}</th>
                  </tr>
                </thead>
                <tbody>
                  {quizRows.map((r) => (
                    <tr key={r.id}>
                      <td>{fmt.format(r.createdAt)}</td>
                      <td>{t(`quiz_${r.quizId}_title`)}</td>
                      <td><b>{r.score} / {r.maxScore}</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
