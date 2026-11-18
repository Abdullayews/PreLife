import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
  AudioLines, Brain, CalendarDays, Flower2,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  MEDIA, bakuParts, moodStreak, psyBySlug, todaysPromptKey, todaysQuoteKey,
} from "@/lib/diet";
import { MoodCheck } from "@/components/diet/MoodCheck";
import { BreathCircle } from "@/components/diet/BreathCircle";
import { AudioPlayerCard } from "@/components/diet/AudioPlayerCard";
import { VideoCard } from "@/components/diet/VideoCard";
import { AiPanel } from "@/components/diet/AiPanel";
import { JournalCard } from "@/components/diet/JournalCard";
import { DietShell } from "@/components/diet/DietShell";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dietApp" });
  return { title: t("metaTitle"), description: t("metaDescription") };
}

const SUBPAGES = [
  { href: "/diet/psychologists", key: "subPsychologists", icon: Brain } as const,
  { href: "/diet/bookings", key: "subBookings", icon: CalendarDays } as const,
  { href: "/diet/mood", key: "subMood", icon: Flower2 } as const,
  { href: "/diet/practice", key: "subPractice", icon: AudioLines } as const,
];

export default async function MeditationPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "dietApp" });
  const user = await requireUser(locale, "/diet");
  const now = new Date();
  const logs = await db.moodLog.findMany({
    where: { userId: user.id },
    orderBy: { date: "desc" },
    take: 60,
  });
  const today = bakuParts(now).date;
  const todayLog = logs.find((l) => l.date === today) ?? null;

  const appointments = await db.appointment.findMany({
    where: { userId: user.id, status: "upcoming", startAt: { gt: now } },
    orderBy: { startAt: "asc" },
    take: 3,
  });

  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
  const progress = await db.meditationProgress.aggregate({
    where: { userId: user.id, createdAt: { gte: weekAgo } },
    _sum: { seconds: true },
  });
  const doneSessions = await db.appointment.count({
    where: { userId: user.id, startAt: { lte: now }, status: "upcoming" },
  });

  const streak = moodStreak(logs.map((l) => l.date));
  const minutesThisWeek = Math.round((progress._sum.seconds ?? 0) / 60);

  const greeting =
    bakuParts(now).hour < 12 ? t("greetMorning")
    : bakuParts(now).hour < 18 ? t("greetAfternoon")
    : t("greetEvening");

  // Deterministic "pick of the day": the date's digit sum mod the audio
  // count — stable per day, no hydration concerns (server-rendered).
  // Non-digit separators are stripped first so the sum can never be NaN.
  const audioItems = MEDIA.filter((m) => m.kind === "audio");
  const digitSum = [...today].reduce((a, ch) => a + (/\d/.test(ch) ? Number(ch) : 0), 0);
  const pick = audioItems[digitSum % audioItems.length]!;
  const promptKey = todaysPromptKey();

  const fmt = new Intl.DateTimeFormat(locale, {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Baku",
  });

  return (
    <DietShell locale={locale} active="overview">
      <div className="wrap">
        <header className="page-head">
          <p className="eyebrow"><i />{greeting}{user.name ? `, ${user.name}` : ""}</p>
          <h1 className="display sm">{t("homeTitle")}</h1>
          <p className="lede">{t("homeSubtitle")}</p>
        </header>

        <section aria-label={t("quoteEyebrow")} className="quote">
          <p>{t(todaysQuoteKey())}</p>
          <footer><i aria-hidden />PreLife · {t("quoteEyebrow")}</footer>
        </section>

        <section aria-label={t("statsEyebrow")} className="blk">
          <h2 className="eyebrow"><b>{t("statsEyebrow")}</b></h2>
          <dl className="mini-stats">
            <div className="mini-stat"><dt>{t("statStreak")}</dt><dd>{streak}</dd></div>
            <div className="mini-stat"><dt>{t("statSessions")}</dt><dd>{doneSessions}</dd></div>
            <div className="mini-stat"><dt>{t("statMinutes")}</dt><dd>{minutesThisWeek}</dd></div>
          </dl>
        </section>

        <section aria-labelledby="today-h" className="blk">
          <h2 id="today-h" className="eyebrow"><b>01</b>{t("todayEyebrow")}</h2>
          <ul className="cards2">
            <li className="card">
              <div className="card-top">
                <span className="chip-ico tinted"><Flower2 size={20} aria-hidden /></span>
                <span className="eyebrow">{t("moodEyebrow")}</span>
              </div>
              <p className="mood-state" style={{ color: "var(--muted)" }}>
                {todayLog ? t("moodDone", { mood: todayLog.mood, energy: todayLog.energy, sleep: todayLog.sleepQ }) : t("moodTodo")}
              </p>
              <MoodCheck
                compact
                initial={todayLog ? { mood: todayLog.mood, energy: todayLog.energy, sleepQ: todayLog.sleepQ, tags: todayLog.tags ? todayLog.tags.split(",") : [], note: todayLog.note ?? "" } : null}
              />
            </li>
            <li>
              <BreathCircle />
            </li>
          </ul>
          <p className="note">
            <Link href="/diet/mood">{t("moodOpenFull")}</Link>
          </p>
        </section>

        <section aria-labelledby="practice-h" className="blk">
          <h2 id="practice-h" className="eyebrow"><b>02</b>{t("pickEyebrow")}</h2>
          <AudioPlayerCard id={pick.id} src={pick.src} title={t(pick.titleKey)} desc={t(pick.descKey)} />
          <ul className="media-row" style={{ marginTop: "1rem" }}>
            {MEDIA.filter((m) => m.kind === "video").map((m) => (
              <li key={m.id}>
                <VideoCard id={m.id} src={m.src} poster={m.poster} title={t(m.titleKey)} desc={t(m.descKey)} />
              </li>
            ))}
          </ul>
          <p className="note"><Link href="/diet/practice">{t("practiceOpenAll")}</Link></p>
        </section>

        <section aria-labelledby="ai-h" className="blk">
          <h2 id="ai-h" className="eyebrow"><b>03</b>{t("aiEyebrow")}</h2>
          <AiPanel />
        </section>

        <section aria-labelledby="journal-h" className="blk">
          <h2 id="journal-h" className="eyebrow"><b>04</b>{t("journalEyebrow")}</h2>
          <JournalCard prompt={t(promptKey)} promptKey={promptKey} />
          <p className="note"><Link href="/diet/journal">{t("journalOpenArchive")}</Link></p>
        </section>

        {appointments.length > 0 && (
          <section aria-labelledby="sessions-h" className="blk">
            <h2 id="sessions-h" className="eyebrow"><b>05</b>{t("sessionsEyebrow")}</h2>
            <ul className="jrnl">
              {appointments.map((a) => {
                const psy = psyBySlug(a.psychologistSlug);
                return (
                  <li key={a.id} className="jrnl-entry">
                    <div className="row">
                      <span className="chip-ico tinted"><CalendarDays size={18} aria-hidden /></span>
                      <b>{psy ? t(psy.nameKey) : a.psychologistSlug}</b>
                      <time style={{ marginLeft: "auto" }}>{fmt.format(a.startAt)}</time>
                    </div>
                    <div className="row">
                      <span className="tag">{t(`format_${a.mode}`)}</span>
                      <span className="tag">{a.price} AZN</span>
                      <span className="paytag" data-pay={a.payment}>{t(a.payment === "paid" ? "payPaid" : "payUnpaid")}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="note"><Link href="/diet/bookings">{t("sessionsOpenAll")}</Link></p>
          </section>
        )}

        <section aria-labelledby="explore-h" className="blk">
          <h2 id="explore-h" className="eyebrow"><b>06</b>{t("subEyebrow")}</h2>
          <ul className="cards4">
            {SUBPAGES.map(({ href, key, icon: Icon }) => (
              <li key={key}>
                <Link href={href} className="card">
                  <span className="chip-ico tinted"><Icon size={20} aria-hidden /></span>
                  <h3>{t(`${key}Title`)}</h3>
                  <p>{t(`${key}Desc`)}</p>
                  <em>{t("subOpen")}</em>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </DietShell>
  );
}
