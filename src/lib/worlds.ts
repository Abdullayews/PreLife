import {
  Activity, BedDouble, Bookmark, Brain, ChefHat, Compass, Dumbbell, Feather,
  Fish, Flame, HeartPulse, Landmark, Leaf, Lightbulb, MessagesSquare, Microscope,
  Moon, PersonStanding, Salad, Scale, ShieldCheck, Soup, Sparkles, Sun, Target,
  Timer, Waves, Wheat, Wind, Zap, type LucideIcon,
} from "lucide-react";

/**
 * One typed description per content "world" (gym, diet, meditation, library).
 * This file holds only structure, numbers, schedule matrices and media.
 * Every visible string is a key into the world's message namespace
 * (messages/*.json) — nothing is written here.
 */
export type WorldSlug = "gym" | "diet" | "meditation" | "library";
export type Level = "beginner" | "intermediate" | "advanced";

export type Plan = {
  id: string;
  nameKey: string;
  descKey: string;
  image: string;
  level: Level;
  featured?: boolean;
  /** [message key, ICU {count}] — three facts shown under the plan. */
  meta: [string, number][];
};
export type Item = { id: string; nameKey: string; targetKey: string; icon: LucideIcon; level: Level };
export type Place = {
  id: string; nameKey: string; descKey: string; image: string;
  rating: number; featureKeys: string[];
};
export type Slot = { time: string; labelKey: string; cells: string[] };

export type World = {
  slug: WorldSlug;
  ns: string;
  icon: LucideIcon;
  /** Anchor ids used by the hero CTAs and in-page sections. */
  ids: { plans: string; items: string; places: string };
  /** Prefixes of the `<prefix>Eyebrow/Title/Subtitle` copy keys. */
  prefix: { items: string; places: string };
  hero: { images: string[]; positions: string[]; stats: [string, string][] };
  plans: Plan[];
  items: Item[];
  featureIcons: LucideIcon[];
  schedule: { slots: Slot[]; cellKeys: Record<string, string> };
  initials: string[];
  places: Place[];
};

const u = (id: string, w: number) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`;

export const scheduleDayKeys = [
  "scheduleDayMon", "scheduleDayTue", "scheduleDayWed",
  "scheduleDayThu", "scheduleDayFri", "scheduleDaySat",
] as const;

const gym: World = {
  slug: "gym", ns: "gymHome", icon: Dumbbell,
  ids: { plans: "plans", items: "exercises", places: "gyms" },
  prefix: { items: "exercises", places: "gyms" },
  hero: {
    images: [u("1534438327276-14e5300c3a48", 2400), u("1517836357463-d25dfeac3438", 2400), u("1541534741688-6078c6bfb5c5", 2400)],
    positions: ["center 35%", "center 45%", "center 40%"],
    stats: [["heroStatPlansValue", "heroStatPlansLabel"], ["heroStatExercisesValue", "heroStatExercisesLabel"], ["heroStatGymsValue", "heroStatGymsLabel"]],
  },
  plans: [
    { id: "foundation", nameKey: "planFoundationName", descKey: "planFoundationDesc", image: u("1583454110551-21f2fa2afe61", 1200), level: "beginner", meta: [["plansMetaDays", 3], ["plansMetaWeeks", 8], ["plansMetaKcal", 320]] },
    { id: "hypertrophy", nameKey: "planHypertrophyName", descKey: "planHypertrophyDesc", image: u("1517836357463-d25dfeac3438", 1200), level: "intermediate", featured: true, meta: [["plansMetaDays", 4], ["plansMetaWeeks", 12], ["plansMetaKcal", 410]] },
    { id: "athletic", nameKey: "planAthleticName", descKey: "planAthleticDesc", image: u("1541534741688-6078c6bfb5c5", 1200), level: "advanced", meta: [["plansMetaDays", 5], ["plansMetaWeeks", 6], ["plansMetaKcal", 520]] },
  ],
  items: [
    { id: "squat", nameKey: "exSquatName", targetKey: "exSquatTarget", icon: Dumbbell, level: "intermediate" },
    { id: "deadlift", nameKey: "exDeadliftName", targetKey: "exDeadliftTarget", icon: Zap, level: "advanced" },
    { id: "bench", nameKey: "exBenchName", targetKey: "exBenchTarget", icon: Activity, level: "intermediate" },
    { id: "kettlebell", nameKey: "exKettlebellName", targetKey: "exKettlebellTarget", icon: Flame, level: "beginner" },
    { id: "pullup", nameKey: "exPullupName", targetKey: "exPullupTarget", icon: PersonStanding, level: "intermediate" },
    { id: "farmer", nameKey: "exFarmerName", targetKey: "exFarmerTarget", icon: HeartPulse, level: "beginner" },
  ],
  featureIcons: [Compass, ShieldCheck, Waves, Salad],
  schedule: {
    slots: [
      { time: "07:00", labelKey: "scheduleSlotMorning", cells: ["strength", "open", "strength", "conditioning", "strength", "conditioning"] },
      { time: "12:30", labelKey: "scheduleSlotMidday", cells: ["mobility", "conditioning", "mobility", "mobility", "open", "mobility"] },
      { time: "18:30", labelKey: "scheduleSlotEvening", cells: ["conditioning", "strength", "open", "strength", "conditioning", "strength"] },
    ],
    cellKeys: { strength: "scheduleClassStrength", conditioning: "scheduleClassConditioning", mobility: "scheduleClassMobility", open: "scheduleClassOpen" },
  },
  initials: ["AR", "EM", "MS"],
  places: [
    { id: "ironhouse", nameKey: "venueIronName", descKey: "venueIronDesc", image: u("1593079831268-3381b0db4a77", 1200), rating: 4.8, featureKeys: ["feat247", "featSauna", "featPool"] },
    { id: "pulse", nameKey: "venuePulseName", descKey: "venuePulseDesc", image: u("1546483875-ad9014c88eba", 1200), rating: 4.6, featureKeys: ["featClasses", "featCardio", "featParking"] },
    { id: "vertex", nameKey: "venueVertexName", descKey: "venueVertexDesc", image: u("1571902943202-507ec2618e8f", 1200), rating: 4.9, featureKeys: ["featPlatforms", "featCoaching", "featRecovery"] },
  ],
};

const diet: World = {
  slug: "diet", ns: "dietHome", icon: Salad,
  ids: { plans: "plans", items: "recipes", places: "venues" },
  prefix: { items: "recipes", places: "venues" },
  hero: {
    images: [u("1512621776951-a57141f2eefd", 2400), u("1490645935967-10de6ba17061", 2400), u("1504674900247-0877df9cc836", 2400)],
    positions: ["center 62%", "center 50%", "center 45%"],
    stats: [["heroStatRecipesValue", "heroStatRecipesLabel"], ["heroStatExpertsValue", "heroStatExpertsLabel"], ["heroStatVenuesValue", "heroStatVenuesLabel"]],
  },
  plans: [
    { id: "balance", nameKey: "planBalanceName", descKey: "planBalanceDesc", image: u("1546069901-ba9599a7e63c", 1200), level: "beginner", meta: [["plansMetaMeals", 3], ["plansMetaWeeks", 4], ["plansMetaKcal", 1800]] },
    { id: "lean", nameKey: "planLeanName", descKey: "planLeanDesc", image: u("1467003909585-2f8a72700288", 1200), level: "intermediate", featured: true, meta: [["plansMetaMeals", 4], ["plansMetaWeeks", 8], ["plansMetaKcal", 2100]] },
    { id: "performance", nameKey: "planPerformanceName", descKey: "planPerformanceDesc", image: u("1490645935967-10de6ba17061", 1200), level: "advanced", meta: [["plansMetaMeals", 5], ["plansMetaWeeks", 12], ["plansMetaKcal", 2800]] },
  ],
  items: [
    { id: "protein-bowl", nameKey: "recBowlName", targetKey: "recBowlTarget", icon: HeartPulse, level: "beginner" },
    { id: "market-salad", nameKey: "recSaladName", targetKey: "recSaladTarget", icon: Leaf, level: "beginner" },
    { id: "lentil-soup", nameKey: "recSoupName", targetKey: "recSoupTarget", icon: Soup, level: "beginner" },
    { id: "salmon", nameKey: "recSalmonName", targetKey: "recSalmonTarget", icon: Fish, level: "intermediate" },
    { id: "oats", nameKey: "recOatsName", targetKey: "recOatsTarget", icon: Wheat, level: "beginner" },
    { id: "chefs-plate", nameKey: "recChefName", targetKey: "recChefTarget", icon: ChefHat, level: "advanced" },
  ],
  featureIcons: [Scale, Leaf, ChefHat, Compass],
  schedule: {
    slots: [
      { time: "07:30", labelKey: "scheduleSlotBreakfast", cells: ["protein", "plant", "light", "protein", "chef", "protein"] },
      { time: "12:30", labelKey: "scheduleSlotLunch", cells: ["plant", "protein", "chef", "light", "protein", "plant"] },
      { time: "16:00", labelKey: "scheduleSlotSnack", cells: ["light", "light", "plant", "chef", "light", "light"] },
      { time: "19:30", labelKey: "scheduleSlotDinner", cells: ["chef", "light", "protein", "plant", "chef", "protein"] },
    ],
    cellKeys: { protein: "scheduleMealProtein", plant: "scheduleMealPlant", light: "scheduleMealLight", chef: "scheduleMealChef" },
  },
  initials: ["LA", "DN", "SA"],
  places: [
    { id: "green-market", nameKey: "venueMarketName", descKey: "venueMarketDesc", image: u("1488459716781-31db52582fe9", 1200), rating: 4.8, featureKeys: ["featOrganic", "featLocal", "featSeasonalBox"] },
    { id: "fit-kitchen", nameKey: "venueKitchenName", descKey: "venueKitchenDesc", image: u("1512058564366-18510be2db19", 1200), rating: 4.7, featureKeys: ["featMealPrep", "featMacros", "featDelivery"] },
    { id: "nourish-bar", nameKey: "venueBarName", descKey: "venueBarDesc", image: u("1554118811-1e0d58224f24", 1200), rating: 4.9, featureKeys: ["featJuice", "featVegan", "featNutritionist"] },
  ],
};

const meditation: World = {
  slug: "meditation", ns: "meditationHome", icon: Brain,
  ids: { plans: "programs", items: "sessions", places: "mentors" },
  prefix: { items: "sessions", places: "mentors" },
  hero: {
    images: [u("1506126613408-eca07ce68773", 2400), u("1545205597-3d9d02c29597", 2400), u("1499209974431-9dddcece7f88", 2400)],
    positions: ["center 38%", "center 45%", "center 40%"],
    stats: [["heroStatSessionsValue", "heroStatSessionsLabel"], ["heroStatMentorsValue", "heroStatMentorsLabel"], ["heroStatSleepValue", "heroStatSleepLabel"]],
  },
  plans: [
    { id: "foundations", nameKey: "planFoundationsName", descKey: "planFoundationsDesc", image: u("1544367567-0f2fcb009e0b", 1200), level: "beginner", meta: [["plansMetaMinutes", 10], ["plansMetaDays", 7], ["plansMetaSessions", 5]] },
    { id: "deep-focus", nameKey: "planFocusName", descKey: "planFocusDesc", image: u("1545389336-cf090694435e", 1200), level: "intermediate", featured: true, meta: [["plansMetaMinutes", 15], ["plansMetaDays", 21], ["plansMetaSessions", 6]] },
    { id: "sleep-reset", nameKey: "planSleepName", descKey: "planSleepDesc", image: u("1499209974431-9dddcece7f88", 1200), level: "advanced", meta: [["plansMetaMinutes", 20], ["plansMetaDays", 14], ["plansMetaSessions", 7]] },
  ],
  items: [
    { id: "box-breathing", nameKey: "sesBoxName", targetKey: "sesBoxTarget", icon: Wind, level: "beginner" },
    { id: "body-scan", nameKey: "sesBodyName", targetKey: "sesBodyTarget", icon: PersonStanding, level: "beginner" },
    { id: "morning-intention", nameKey: "sesMorningName", targetKey: "sesMorningTarget", icon: Sun, level: "beginner" },
    { id: "loving-kindness", nameKey: "sesKindnessName", targetKey: "sesKindnessTarget", icon: HeartPulse, level: "intermediate" },
    { id: "walking", nameKey: "sesWalkingName", targetKey: "sesWalkingTarget", icon: Timer, level: "intermediate" },
    { id: "evening-unwind", nameKey: "sesEveningName", targetKey: "sesEveningTarget", icon: Moon, level: "advanced" },
  ],
  featureIcons: [Brain, Timer, BedDouble, Compass],
  schedule: {
    slots: [
      { time: "07:00", labelKey: "scheduleSlotMorning", cells: ["breathe", "focus", "breathe", "focus", "breathe", "rest"] },
      { time: "13:00", labelKey: "scheduleSlotMidday", cells: ["focus", "rest", "focus", "breathe", "focus", "breathe"] },
      { time: "21:00", labelKey: "scheduleSlotEvening", cells: ["sleep", "sleep", "rest", "sleep", "sleep", "focus"] },
    ],
    cellKeys: { breathe: "scheduleTrackBreathe", focus: "scheduleTrackFocus", sleep: "scheduleTrackSleep", rest: "scheduleTrackRest" },
  },
  initials: ["NB", "TI", "KG"],
  places: [
    { id: "leyla-m", nameKey: "mentorLeylaName", descKey: "mentorLeylaDesc", image: u("1573496359142-b8d87734a5a2", 1200), rating: 4.9, featureKeys: ["featMbsr", "featGroup", "featOnline"] },
    { id: "samir-a", nameKey: "mentorSamirName", descKey: "mentorSamirDesc", image: u("1507003211169-0a1dd7228f2d", 1200), rating: 4.8, featureKeys: ["featBreathwork", "featOneOnOne", "featCorporate"] },
    { id: "aida-k", nameKey: "mentorAidaName", descKey: "mentorAidaDesc", image: u("1573497019940-1c28c88b4f3e", 1200), rating: 5.0, featureKeys: ["featClinical", "featTrauma", "featTeens"] },
  ],
};

const library: World = {
  slug: "library", ns: "libraryHome", icon: Landmark,
  ids: { plans: "collections", items: "books", places: "venues" },
  prefix: { items: "books", places: "venues" },
  hero: {
    images: [u("1507842217343-583bb7270b66", 2400), u("1481627834876-b7833e8f5570", 2400), u("1524995997946-a1c2e315a42f", 2400)],
    positions: ["center 45%", "center 42%", "center 50%"],
    stats: [["heroStatBooksValue", "heroStatBooksLabel"], ["heroStatCollectionsValue", "heroStatCollectionsLabel"], ["heroStatSummariesValue", "heroStatSummariesLabel"]],
  },
  plans: [
    { id: "foundations", nameKey: "colFoundationsName", descKey: "colFoundationsDesc", image: u("1481627834876-b7833e8f5570", 1200), level: "beginner", meta: [["plansMetaMinutes", 15], ["plansMetaWeeks", 8], ["plansMetaBooks", 24]] },
    { id: "mind", nameKey: "colMindName", descKey: "colMindDesc", image: u("1512820790803-83ca734da794", 1200), level: "intermediate", featured: true, meta: [["plansMetaMinutes", 20], ["plansMetaWeeks", 12], ["plansMetaBooks", 32]] },
    { id: "leadership", nameKey: "colLeadershipName", descKey: "colLeadershipDesc", image: u("1456513080510-7bf3a84b82f8", 1200), level: "advanced", meta: [["plansMetaMinutes", 25], ["plansMetaWeeks", 10], ["plansMetaBooks", 28]] },
  ],
  items: [
    { id: "deep-work", nameKey: "bookDeepWorkName", targetKey: "bookDeepWorkTarget", icon: Target, level: "beginner" },
    { id: "atomic-habits", nameKey: "bookHabitsName", targetKey: "bookHabitsTarget", icon: Compass, level: "beginner" },
    { id: "search-meaning", nameKey: "bookMeaningName", targetKey: "bookMeaningTarget", icon: Lightbulb, level: "intermediate" },
    { id: "thinking-fast", nameKey: "bookThinkingName", targetKey: "bookThinkingTarget", icon: Microscope, level: "intermediate" },
    { id: "meditations", nameKey: "bookMeditationsName", targetKey: "bookMeditationsTarget", icon: Landmark, level: "advanced" },
    { id: "flow", nameKey: "bookFlowName", targetKey: "bookFlowTarget", icon: Sparkles, level: "advanced" },
  ],
  featureIcons: [Feather, Timer, MessagesSquare, Bookmark],
  schedule: {
    slots: [
      { time: "08:00", labelKey: "scheduleSlotCommute", cells: ["summary", "chapter", "summary", "free", "chapter", "chapter"] },
      { time: "13:00", labelKey: "scheduleSlotLunch", cells: ["notes", "summary", "free", "chapter", "summary", "notes"] },
      { time: "21:00", labelKey: "scheduleSlotEvening", cells: ["chapter", "notes", "chapter", "summary", "notes", "free"] },
    ],
    cellKeys: { chapter: "scheduleTrackChapter", summary: "scheduleTrackSummary", notes: "scheduleTrackNotes", free: "scheduleTrackFree" },
  },
  initials: ["ZA", "RG", "EA"],
  places: [
    { id: "nizami-house", nameKey: "venueNizamiName", descKey: "venueNizamiDesc", image: u("1521587760476-6c12a4b040da", 1200), rating: 4.9, featureKeys: ["featLending", "featRare", "featQuiet"] },
    { id: "paper-cup", nameKey: "venuePaperCupName", descKey: "venuePaperCupDesc", image: u("1524578271613-d550eacf6090", 1200), rating: 4.7, featureKeys: ["featCafe", "featWifi", "featEvents"] },
    { id: "reading-room", nameKey: "venueRoomName", descKey: "venueRoomDesc", image: u("1568667256549-094345857637", 1200), rating: 4.8, featureKeys: ["featMembers", "featKids", "featDigital"] },
  ],
};

export const worlds: Record<WorldSlug, World> = { gym, diet, meditation, library };
export const worldSlugs = Object.keys(worlds) as WorldSlug[];

/** Landing-hero frames: the four-worlds still life, then each world's lead photo. */
export const landingFrames = [
  { src: "/img/banner.png", pos: "center" },
  { src: gym.hero.images[0], pos: gym.hero.positions[0] },
  { src: diet.hero.images[0], pos: diet.hero.positions[0] },
  { src: meditation.hero.images[0], pos: meditation.hero.positions[0] },
  { src: library.hero.images[0], pos: library.hero.positions[0] },
];
