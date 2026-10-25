import {
  ChefHat,
  Compass,
  Fish,
  HeartPulse,
  Leaf,
  Scale,
  Soup,
  Wheat,
  type LucideIcon,
} from "lucide-react";

/**
 * Diet module content (v2, "Golden Harvest" theme).
 * Text lives in messages (namespace `dietHome`) - this file only holds typed
 * structure, numbers, meal matrices and media URLs.
 */

export type DietLevel = "beginner" | "intermediate" | "advanced";

export type DietPlan = {
  id: string;
  nameKey: string;
  descKey: string;
  image: string;
  level: DietLevel;
  weeks: number;
  mealsPerDay: number;
  kcal: number;
  featured?: boolean;
};

export type DietRecipe = {
  id: string;
  nameKey: string;
  targetKey: string;
  icon: LucideIcon;
  level: DietLevel;
};

export type DietVenue = {
  id: string;
  nameKey: string;
  descKey: string;
  image: string;
  rating: number;
  featureKeys: string[];
};

export type DietFeature = {
  id: string;
  titleKey: string;
  descKey: string;
  icon: LucideIcon;
};

export type DietStory = {
  id: string;
  quoteKey: string;
  nameKey: string;
  roleKey: string;
  initials: string;
};

export type DietMealId = "protein" | "plant" | "light" | "chef";

export type DietSlot = {
  time: string;
  labelKey: string;
  meals: DietMealId[];
};

const unsplash = (id: string, width: number) =>
  `https://images.unsplash.com/photo-${id}?w=${width}&q=80&auto=format&fit=crop`;

export const dietHeroImage = unsplash("1512621776951-a57141f2eefd", 2400);

/* Hero gallery frames: the signature salad bowl, then the full healthy
   table and the plated dish close-up. */
export const dietHeroImages: string[] = [
  dietHeroImage,
  unsplash("1490645935967-10de6ba17061", 2400),
  unsplash("1504674900247-0877df9cc836", 2400),
];
export const dietHeroImagePositions: string[] = [
  "center 62%",
  "center 50%",
  "center 45%",
];

export const dietPlans: DietPlan[] = [
  {
    id: "balance",
    nameKey: "planBalanceName",
    descKey: "planBalanceDesc",
    image: unsplash("1546069901-ba9599a7e63c", 1600),
    level: "beginner",
    weeks: 4,
    mealsPerDay: 3,
    kcal: 1800,
  },
  {
    id: "lean",
    nameKey: "planLeanName",
    descKey: "planLeanDesc",
    image: unsplash("1467003909585-2f8a72700288", 1600),
    level: "intermediate",
    weeks: 8,
    mealsPerDay: 4,
    kcal: 2100,
    featured: true,
  },
  {
    id: "performance",
    nameKey: "planPerformanceName",
    descKey: "planPerformanceDesc",
    image: unsplash("1490645935967-10de6ba17061", 1600),
    level: "advanced",
    weeks: 12,
    mealsPerDay: 5,
    kcal: 2800,
  },
];

export const dietRecipes: DietRecipe[] = [
  {
    id: "protein-bowl",
    nameKey: "recBowlName",
    targetKey: "recBowlTarget",
    icon: HeartPulse,
    level: "beginner",
  },
  {
    id: "market-salad",
    nameKey: "recSaladName",
    targetKey: "recSaladTarget",
    icon: Leaf,
    level: "beginner",
  },
  {
    id: "lentil-soup",
    nameKey: "recSoupName",
    targetKey: "recSoupTarget",
    icon: Soup,
    level: "beginner",
  },
  {
    id: "salmon",
    nameKey: "recSalmonName",
    targetKey: "recSalmonTarget",
    icon: Fish,
    level: "intermediate",
  },
  {
    id: "oats",
    nameKey: "recOatsName",
    targetKey: "recOatsTarget",
    icon: Wheat,
    level: "beginner",
  },
  {
    id: "chefs-plate",
    nameKey: "recChefName",
    targetKey: "recChefTarget",
    icon: ChefHat,
    level: "advanced",
  },
];

export const dietFeatures: DietFeature[] = [
  {
    id: "macros",
    titleKey: "why1Title",
    descKey: "why1Desc",
    icon: Scale,
  },
  {
    id: "seasonal",
    titleKey: "why2Title",
    descKey: "why2Desc",
    icon: Leaf,
  },
  {
    id: "recipes",
    titleKey: "why3Title",
    descKey: "why3Desc",
    icon: ChefHat,
  },
  {
    id: "habits",
    titleKey: "why4Title",
    descKey: "why4Desc",
    icon: Compass,
  },
];

export const dietSchedule: DietSlot[] = [
  {
    time: "07:30",
    labelKey: "scheduleSlotBreakfast",
    meals: ["protein", "plant", "light", "protein", "chef", "protein"],
  },
  {
    time: "12:30",
    labelKey: "scheduleSlotLunch",
    meals: ["plant", "protein", "chef", "light", "protein", "plant"],
  },
  {
    time: "16:00",
    labelKey: "scheduleSlotSnack",
    meals: ["light", "light", "plant", "chef", "light", "light"],
  },
  {
    time: "19:30",
    labelKey: "scheduleSlotDinner",
    meals: ["chef", "light", "protein", "plant", "chef", "protein"],
  },
];

export const dietScheduleDays = [
  "scheduleDayMon",
  "scheduleDayTue",
  "scheduleDayWed",
  "scheduleDayThu",
  "scheduleDayFri",
  "scheduleDaySat",
];

export const dietMealLabelKeys: Record<DietMealId, string> = {
  protein: "scheduleMealProtein",
  plant: "scheduleMealPlant",
  light: "scheduleMealLight",
  chef: "scheduleMealChef",
};

export const dietStories: DietStory[] = [
  {
    id: "leyla",
    quoteKey: "stories1Quote",
    nameKey: "stories1Name",
    roleKey: "stories1Role",
    initials: "LA",
  },
  {
    id: "dashkin",
    quoteKey: "stories2Quote",
    nameKey: "stories2Name",
    roleKey: "stories2Role",
    initials: "DN",
  },
  {
    id: "sanubar",
    quoteKey: "stories3Quote",
    nameKey: "stories3Name",
    roleKey: "stories3Role",
    initials: "SA",
  },
];

export const dietVenues: DietVenue[] = [
  {
    id: "green-market",
    nameKey: "venueMarketName",
    descKey: "venueMarketDesc",
    image: unsplash("1488459716781-31db52582fe9", 1600),
    rating: 4.8,
    featureKeys: ["featOrganic", "featLocal", "featSeasonalBox"],
  },
  {
    id: "fit-kitchen",
    nameKey: "venueKitchenName",
    descKey: "venueKitchenDesc",
    image: unsplash("1512058564366-18510be2db19", 1600),
    rating: 4.7,
    featureKeys: ["featMealPrep", "featMacros", "featDelivery"],
  },
  {
    id: "nourish-bar",
    nameKey: "venueBarName",
    descKey: "venueBarDesc",
    image: unsplash("1554118811-1e0d58224f24", 1600),
    rating: 4.9,
    featureKeys: ["featJuice", "featVegan", "featNutritionist"],
  },
];
