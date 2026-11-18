import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { GymApp, type GymAppStrings } from "@/components/gym/GymApp";
import {
  GYM_PLACES, PLAN_WEEKS, SHOP_TAB_IDS, STORES,
  gymPlans, gymSchedule, minPriceOf, productsOf, scheduleDayKeys,
  isGymTabId, type GymTabId, type ShopTabId,
} from "@/lib/gym";

type Props = {
  params: Promise<{ locale: string }>;
  /** ?tab=<gym subtab> — deep-links from the home dashboard. */
  searchParams: Promise<{ tab?: string | string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "gymApp" });
  return { title: t("metaTitle"), description: t("metaDescription") };
}

/** level keys in gymHome: levelBeginner / levelIntermediate / levelAdvanced. */
const cap = (l: string) => l[0]!.toUpperCase() + l.slice(1);

const kindKeys = Object.keys(gymSchedule.cellKeys);

export default async function GymPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  await requireUser(locale, "/gym");

  const tabParam = Array.isArray(sp.tab) ? sp.tab[0] : sp.tab;
  const initialTab: GymTabId = tabParam && isGymTabId(tabParam) ? tabParam : "plan";
  /** A valid ?tab= was in the URL — a shareable deep link beats the
   *  remembered tab when the client restores its last choice. */
  const linked = tabParam === initialTab;

  const t = await getTranslations({ locale, namespace: "gymApp" });
  // gymHome carries the shared gym copy (plans, levels, features, schedule…)
  // written for the welcome page — reuse it instead of duplicating strings.
  const tw = await getTranslations({ locale, namespace: "gymHome" });

  const plans = gymPlans.map((p) => {
    const w = PLAN_WEEKS[p.id] ?? { week: 1, total: 12 };
    const percent = Math.round((w.week / w.total) * 100);
    return {
      id: p.id,
      name: tw(p.nameKey),
      desc: tw(p.descKey),
      level: tw(`level${cap(p.level)}`),
      meta: p.meta.map(([key, count]) => tw(key, { count })),
      image: p.image,
      featured: !!p.featured,
      weekLabel: t("plan.weekLabel", { week: w.week, total: w.total }),
      percent,
      progressA11y: t("plan.progressA11y", { percent }),
    };
  });

  const shops = Object.fromEntries(
    SHOP_TAB_IDS.map((id) => [
      id,
      productsOf(id).map((p) => {
        const cheapest = minPriceOf(p);
        return {
          id: p.id,
          name: t(`${id}.${p.nameKey}`),
          brand: p.brand,
          priceLabel: `${p.price[0]}–${p.price[1]} ₼`,
          minPrice: cheapest,
          // Index of the cheapest store row — wins ties by first occurrence.
          best: p.at.findIndex((a) => a.price === cheapest),
          countLabel: t("atCount", { count: p.at.length }),
          at: p.at.map(({ store, price }) => {
            const s = STORES[store]!;
            return { name: s.name, kind: t(`kind_${s.kind}`), url: s.url, price };
          }),
        };
      }),
    ]),
  ) as Record<ShopTabId, GymAppStrings["shops"][ShopTabId]>;

  const strings: GymAppStrings = {
    tabs: {
      plan: t("tab_plan"),
      gyms: t("tab_gyms"),
      equipment: t("tab_equipment"),
      supplements: t("tab_supplements"),
      accessories: t("tab_accessories"),
      clothing: t("tab_clothing"),
    },
    railLabel: t("railLabel"),
    railOpen: t("railOpen"),
    railClose: t("railClose"),
    currentTabSr: t("currentTabSr"),
    heads: {
      plan: { eyebrow: t("heads.plan.eyebrow"), title: t("heads.plan.title"), lede: t("heads.plan.lede") },
      gyms: { eyebrow: t("heads.gyms.eyebrow"), title: t("heads.gyms.title"), lede: t("heads.gyms.lede") },
      equipment: { eyebrow: t("heads.equipment.eyebrow"), title: t("heads.equipment.title"), lede: t("heads.equipment.lede") },
      supplements: { eyebrow: t("heads.supplements.eyebrow"), title: t("heads.supplements.title"), lede: t("heads.supplements.lede") },
      accessories: { eyebrow: t("heads.accessories.eyebrow"), title: t("heads.accessories.title"), lede: t("heads.accessories.lede") },
      clothing: { eyebrow: t("heads.clothing.eyebrow"), title: t("heads.clothing.title"), lede: t("heads.clothing.lede") },
    },
    shopNote: t("shopNote"),
    whereToBuy: t("whereToBuy"),
    bestPrice: t("bestPrice"),
    sortLabel: t("sortLabel"),
    sortPopular: t("sortPopular"),
    sortCheap: t("sortCheap"),
    searchLabel: t("searchLabel"),
    searchPlaceholder: t("searchPlaceholder"),
    searchClear: t("searchClear"),
    /* Raw template — {shown}/{total} are filled in client-side (the count
     * is unknown at render time, so t() would demand the ICU values). */
    resultsA11y: String(t.raw("resultsA11y")),
    noResults: t("noResults"),
    plans,
    planUi: {
      activeEyebrow: t("plan.activeEyebrow"),
      activeTag: t("plan.activeTag"),
      select: t("plan.select"),
      plansEyebrow: t("plan.plansEyebrow"),
      switchHint: t("plan.switchHint"),
      scheduleEyebrow: t("plan.scheduleEyebrow"),
      scheduleA11y: t("plan.scheduleA11y"),
      timeCol: tw("scheduleTime"),
      doneCta: t("plan.doneCta"),
      doneLabel: t("plan.doneLabel"),
      doneUndo: t("plan.doneUndo"),
    },
    schedule: {
      days: scheduleDayKeys.map((k) => tw(k)),
      slots: gymSchedule.slots.map((slot) => ({
        time: slot.time,
        label: tw(slot.labelKey),
        cells: slot.cells.map((cell) => ({
          label: tw(gymSchedule.cellKeys[cell]),
          kind: kindKeys.indexOf(cell),
        })),
      })),
    },
    gyms: GYM_PLACES.map((g) => ({
      id: g.id,
      name: g.ns === "gymHome" ? tw(g.nameKey) : t(g.nameKey),
      desc: g.ns === "gymHome" ? tw(g.descKey) : t(g.descKey),
      image: g.image,
      rating: g.rating,
      ratingA11y: tw("gymsRatingA11y", { score: g.rating }),
      features: g.featureKeys.map((k) => tw(k)),
      address: g.address,
      hours: g.hours,
      dayPrice: g.dayPrice,
    })),
    gymsUi: {
      dayPass: t("gyms.dayPass"),
      mapsCta: t("gyms.mapsCta"),
      openHoursSr: t("gyms.openHoursSr"),
      sortRating: t("gyms.sortRating"),
      sortPrice: t("gyms.sortPrice"),
      filterLabel: t("gyms.filterLabel"),
      filterAll: t("gyms.filterAll"),
      gymsNoResults: t("gyms.gymsNoResults"),
    },
    shops,
  };

  const initialPlan = gymPlans.find((p) => p.featured)?.id ?? gymPlans[0]!.id;

  return (
    <div data-world="gym" className="world app-page">
      <GymApp
        initialTab={initialTab}
        initialPlan={initialPlan}
        linked={linked}
        strings={strings}
      >
        <header className="page-head">
          <p className="eyebrow"><i />PreLife Gym</p>
          <h1 className="display sm">{t("title")}</h1>
          <p className="lede">{t("lede")}</p>
        </header>
      </GymApp>
    </div>
  );
}
