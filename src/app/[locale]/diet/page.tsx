import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ArrowRight, CalendarDays, ChefHat, MapPin } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getDietContent } from "@/lib/api";
import { ContentUnavailable } from "@/components/ContentUnavailable";
import { bakuParts } from "@/lib/psychology";
import { recipeOfTheDay, RECIPE_ICONS } from "@/lib/nutrition";
import { WaterTracker } from "@/components/diet/WaterTracker";
import { DietShell } from "@/components/diet/DietShell";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dietApp" });
  return { title: t("metaTitle"), description: t("metaDescription") };
}

export default async function DietOverviewPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale, "/diet");

  const t = await getTranslations({ locale, namespace: "dietApp" });

  // Recipes, plans and venues come from the Rust API (Supabase Postgres).
  const diet = await getDietContent();
  if (!diet) return <ContentUnavailable locale={locale} />;
  const hour = bakuParts(new Date()).hour;
  const greeting =
    hour < 12 ? t("greetMorning") : hour < 18 ? t("greetAfternoon") : t("greetEvening");

  /* Deterministic pick of the day — stable per day, server-rendered. */
  const pickId = recipeOfTheDay(diet.recipes);
  const pick = diet.recipes.find((r) => r.id === pickId)!;
  const pickDetail = diet.recipeDetails[pickId]!;
  const PickIcon = RECIPE_ICONS[pickId] ?? ChefHat;

  const SUBPAGES = [
    { href: "/diet/plans", key: "subPlans", icon: CalendarDays, title: t("subPlansTitle"), desc: t("subPlansDesc") },
    { href: "/diet/recipes", key: "subRecipes", icon: ChefHat, title: t("subRecipesTitle"), desc: t("subRecipesDesc") },
    { href: "/diet/places", key: "subPlaces", icon: MapPin, title: t("subPlacesTitle"), desc: t("subPlacesDesc") },
  ] as const;

  return (
    <DietShell locale={locale} active="overview">
      <div className="wrap">
        <header className="page-head">
          <p className="eyebrow"><i />PreLife Nutrition</p>
          <h1 className="display sm">{greeting}{user.name ? `, ${user.name}` : ""}</h1>
          <h2 className="lede">{t("homeTitle")}</h2>
        </header>

        <section aria-labelledby="pick-h" className="blk">
          <h2 id="pick-h" className="eyebrow"><b>01</b>{t("pickEyebrow")}</h2>
          <div className="card pick-card">
            <span className="chip-ico tinted"><PickIcon size={20} aria-hidden /></span>
            <h3>{t(pick.nameKey)}</h3>
            <p>{t(pick.targetKey)}</p>
            <ul className="facts">
              <li>{t("recipeMinutes", { count: pickDetail.minutes })}</li>
              <li>{t("recipeKcal", { count: pickDetail.kcal })}</li>
            </ul>
            <Link href="/diet/recipes" className="btn btn-sm">
              {t("pickOpen")}<ArrowRight size={15} aria-hidden />
            </Link>
          </div>
        </section>

        <section aria-labelledby="water-h" className="blk">
          <h2 id="water-h" className="eyebrow"><b>02</b>{t("waterEyebrow")}</h2>
          <WaterTracker />
        </section>

        <section aria-labelledby="diet-sub-h" className="blk">
          <h2 id="diet-sub-h" className="eyebrow"><b>03</b>{t("subEyebrow")}</h2>
          <ul className="cards3">
            {SUBPAGES.map(({ href, icon: Icon, title, desc }) => (
              <li key={href}>
                <Link href={href} className="card">
                  <span className="chip-ico tinted"><Icon size={20} aria-hidden /></span>
                  <h3>{title}</h3>
                  <p>{desc}</p>
                  <em>{t("subOpen")}<ArrowRight size={15} aria-hidden /></em>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </DietShell>
  );
}
