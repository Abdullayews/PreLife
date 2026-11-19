import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight, Crown, Dumbbell } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { sections, sectionById, type SectionId } from "@/lib/shell";
import { requireUser } from "@/lib/auth";
import { bakuParts } from "@/lib/psychology";
import { GYM_TABS, isShopTab } from "@/lib/gym";
import { getActivePlan } from "@/lib/server/user-plans";
import { getProfileView } from "@/lib/server/profile";
import { listCustomPackages } from "@/lib/server/packages";
import { AppPageShell } from "@/components/AppPageShell";

type Props = { params: Promise<{ locale: string }> };

/** Today's picks — one card per product area, deep-linking into it. */
const PICKS: { key: string; section: SectionId; href: string }[] = [
  { key: "pick1", section: "gym", href: "/gym?tab=plan" },
  { key: "pick2", section: "diet", href: "/diet" },
  { key: "pick3", section: "meditation", href: "/meditation" },
];

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return { title: t("homeTitle"), description: t("homeDescription") };
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale, "/home");

  const t = await getTranslations({ locale, namespace: "homePage" });
  const tm = await getTranslations({ locale, namespace: "welcomePage.modules" });
  const tg = await getTranslations({ locale, namespace: "gymApp" });

  // Real account data (the AI tools and the plan tab read the same rows).
  const [plan, profile, packages] = await Promise.all([
    getActivePlan(user.id),
    getProfileView(user.id),
    listCustomPackages(user.id),
  ]);
  const hasActivePackage = packages.some((p) => p.status === "active");

  // Baku wall-clock drives the greeting; the date line renders in-locale.
  const now = new Date();
  const hour = bakuParts(now).hour;
  const greeting =
    hour < 12 ? t("greetMorning") : hour < 18 ? t("greetAfternoon") : t("greetEvening");
  const dateLine = new Intl.DateTimeFormat(locale, {
    weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Baku",
  }).format(now);

  const shopTabs = GYM_TABS.filter((tab) => isShopTab(tab.id));

  /* This week at a glance — the user's REAL numbers, each deep-linking on. */
  const STATS: { key: string; num: string; labelKey: string; href: string }[] = [
    {
      key: "planWeek",
      num: plan ? `${plan.week}/${plan.total}` : "—",
      labelKey: "statPlanLabel",
      href: "/gym?tab=plan",
    },
    {
      key: "workouts",
      num: plan ? String(plan.days.length) : "0",
      labelKey: "statWorkoutsLabel",
      href: "/gym?tab=plan",
    },
    {
      key: "weight",
      num: profile.weightKg !== null ? String(profile.weightKg) : "—",
      labelKey: "statWeightLabel",
      href: "/profile",
    },
    {
      key: "membership",
      num: hasActivePackage ? "Premium" : t("statMembershipFree"),
      labelKey: "statMembershipLabel",
      href: "/subscription",
    },
  ];

  return (
    <AppPageShell locale={locale}>
      <div className="wrap">
        <header className="page-head">
          <p className="eyebrow"><i />{dateLine}</p>
          <h1 className="display sm">{greeting}{user.name ? `, ${user.name}` : ""}</h1>
        </header>

        {/* Your workout plan — the account's active plan (default starter
            until the questionnaire/AI builds a personal one). */}
        <section aria-label={t("planEyebrow")} className="blk">
          <h2 className="eyebrow"><i />{t("planEyebrow")}</h2>
          {plan ? (
            <div className="banner">
              <span className="chip-ico solid"><Dumbbell size={20} aria-hidden /></span>
              <div>
                <h3 className="h3">{plan.title}</h3>
                <p>
                  {t("planWeek", { week: plan.week, total: plan.total})}
                  {" · "}
                  {t("planPerWeek", { days: plan.days.length })}
                  {" · "}
                  {plan.source === "ai" ? t("planSourceAi") : t("planSourceDefault")}
                </p>
              </div>
              <Link href="/gym?tab=plan" className="btn">
                {profile.planOnboardingDone ? t("planOpen") : t("planCta")}
              </Link>
            </div>
          ) : (
            <div className="banner">
              <span className="chip-ico solid"><Dumbbell size={20} aria-hidden /></span>
              <div>
                <h3 className="h3">{t("planNone")}</h3>
                <p>{t("planNoneText")}</p>
              </div>
              <Link href="/gym?tab=plan" className="btn">{t("planCta")}</Link>
            </div>
          )}
        </section>

        {/* This week at a glance — real numbers, each deep-linking on. */}
        <section aria-label={t("statsEyebrow")} className="blk">
          <h2 className="eyebrow"><i />{t("statsEyebrow")}</h2>
          <ul className="mini-stats cols4">
            {STATS.map((s) => (
              <li key={s.key}>
                <Link href={s.href} className="mini-stat stat-link">
                  <b className="stat-num">{s.num}</b>
                  <span className="stat-label">{t(s.labelKey)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="today" className="blk">
          <h2 id="today" className="eyebrow">{t("today.eyebrow")}</h2>
          <ul className="cards3">
            {PICKS.map(({ key, section, href }) => {
              const s = sectionById(section);
              return (
                <li key={key}>
                  <Link href={href} className="card" style={{ "--c": s.color } as React.CSSProperties}>
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

        {/* Gym store shortcuts — the four shop subtabs under /gym. */}
        <section aria-labelledby="shop" className="blk">
          <h2 id="shop" className="eyebrow"><i />{t("shop.eyebrow")}</h2>
          <p className="lede-panel">{t("shop.hint")}</p>
          <ul className="cards4">
            {shopTabs.map(({ id, icon: Icon }) => (
              <li key={id}>
                <Link href={`/gym?tab=${id}`} className="card">
                  <span className="chip-ico tinted"><Icon size={20} aria-hidden /></span>
                  <h3>{tg(`tab_${id}`)}</h3>
                  <p>{t(`shop.${id}`)}</p>
                  <em>{t("shop.open")}<ArrowRight size={15} aria-hidden /></em>
                </Link>
              </li>
            ))}
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
    </AppPageShell>
  );
}
