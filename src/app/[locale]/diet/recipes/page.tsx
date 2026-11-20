import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ArrowLeft, ChefHat, Clock, Flame, ListChecks } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getDietContent } from "@/lib/api";
import { ContentUnavailable } from "@/components/ContentUnavailable";
import { RECIPE_ICONS } from "@/lib/nutrition";
import { DietShell } from "@/components/diet/DietShell";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dietApp" });
  return { title: t("recipesTitle"), description: t("recipesSubtitle") };
}

/** level keys: levelBeginner / levelIntermediate / levelAdvanced. */
const cap = (l: string) => l[0]!.toUpperCase() + l.slice(1);

export default async function DietRecipesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale, "/diet/recipes");

  const t = await getTranslations({ locale, namespace: "dietApp" });
  const dietContent = await getDietContent(user.location);
  if (!dietContent) return <ContentUnavailable locale={locale} />;
  const { recipes: dietRecipes, recipeDetails: RECIPE_DETAILS } = dietContent;

  return (
    <DietShell locale={locale} active="recipes">
      <div className="wrap">
        <header className="page-head">
          <p className="eyebrow">
            <i />
            <Link href="/diet" className="backlink"><ArrowLeft size={14} aria-hidden /></Link>
            {t("rail_recipes")}
          </p>
          <h1 className="display sm">{t("recipesTitle")}</h1>
          <p className="lede">{t("recipesSubtitle")}</p>
        </header>

        <ul className="drecipes">
          {dietRecipes.map((r) => {
            const detail = RECIPE_DETAILS[r.id]!;
            const Icon = RECIPE_ICONS[r.id] ?? ChefHat;
            return (
              <li key={r.id} className="card drecipe-card">
                <div className="card-top">
                  <span className="chip-ico tinted"><Icon size={20} aria-hidden /></span>
                  <span className="tag">{t(`level${cap(r.level)}`)}</span>
                </div>
                <h3 className="h4">{t(r.nameKey)}</h3>
                <p>{t(r.targetKey)}</p>
                <div className="drecipe-facts">
                  <span><Clock size={14} aria-hidden />{t("recipeMinutes", { count: detail.minutes })}</span>
                  <span><Flame size={14} aria-hidden />{t("recipeKcal", { count: detail.kcal })}</span>
                </div>
                <p className="gprod-buy"><ListChecks size={13} aria-hidden />{t("recipeIngredients")}</p>
                <ul className="chips">
                  {detail.ingredients.map((ing) => <li key={ing}>{t(`ing.${ing}`)}</li>)}
                </ul>
              </li>
            );
          })}
        </ul>
      </div>
    </DietShell>
  );
}
