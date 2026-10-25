import {
  Activity,
  Compass,
  Dumbbell,
  Flame,
  HeartPulse,
  PersonStanding,
  Salad,
  ShieldCheck,
  Waves,
  Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * Gym module content (v2, Midnight Ember theme).
 * Text lives in messages (namespace `gymHome`) - this file only holds typed
 * structure, numbers, class/slot matrices and media URLs.
 */

export type GymLevel = "beginner" | "intermediate" | "advanced";

export type GymPlan = {
  id: string;
  nameKey: string;
  descKey: string;
  image: string;
  level: GymLevel;
  weeks: number;
  daysPerWeek: number;
  kcal: number;
  featured?: boolean;
};

export type GymExercise = {
  id: string;
  nameKey: string;
  targetKey: string;
  icon: LucideIcon;
  level: GymLevel;
};

export type GymVenue = {
  id: string;
  nameKey: string;
  descKey: string;
  image: string;
  rating: number;
  featureKeys: string[];
};

export type GymFeature = {
  id: string;
  titleKey: string;
  descKey: string;
  icon: LucideIcon;
};

export type GymStory = {
  id: string;
  quoteKey: string;
  nameKey: string;
  roleKey: string;
  initials: string;
};

export type GymClassId = "strength" | "conditioning" | "mobility" | "open";

export type GymSlot = {
  time: string;
  labelKey: string;
  classes: GymClassId[];
};

const unsplash = (id: string, width: number) =>
  `https://images.unsplash.com/photo-${id}?w=${width}&q=80&auto=format&fit=crop`;

export const gymHeroImage = unsplash("1534438327276-14e5300c3a48", 2400);

/* Hero gallery frames (BetterMe-style switcher): the moody gym interior
   first, then the dumbbell rack and the rope-training close-up. The old
   single hero stays exported as frame one. */
export const gymHeroImages: string[] = [
  gymHeroImage,
  unsplash("1517836357463-d25dfeac3438", 2400),
  unsplash("1541534741688-6078c6bfb5c5", 2400),
];
export const gymHeroImagePositions: string[] = [
  "center 35%",
  "center 45%",
  "center 40%",
];

export const gymPlans: GymPlan[] = [
  {
    id: "foundation",
    nameKey: "planFoundationName",
    descKey: "planFoundationDesc",
    image: unsplash("1583454110551-21f2fa2afe61", 1600),
    level: "beginner",
    weeks: 8,
    daysPerWeek: 3,
    kcal: 320,
  },
  {
    id: "hypertrophy",
    nameKey: "planHypertrophyName",
    descKey: "planHypertrophyDesc",
    image: unsplash("1517836357463-d25dfeac3438", 1600),
    level: "intermediate",
    weeks: 12,
    daysPerWeek: 4,
    kcal: 410,
    featured: true,
  },
  {
    id: "athletic",
    nameKey: "planAthleticName",
    descKey: "planAthleticDesc",
    image: unsplash("1541534741688-6078c6bfb5c5", 1600),
    level: "advanced",
    weeks: 6,
    daysPerWeek: 5,
    kcal: 520,
  },
];

export const gymExercises: GymExercise[] = [
  {
    id: "squat",
    nameKey: "exSquatName",
    targetKey: "exSquatTarget",
    icon: Dumbbell,
    level: "intermediate",
  },
  {
    id: "deadlift",
    nameKey: "exDeadliftName",
    targetKey: "exDeadliftTarget",
    icon: Zap,
    level: "advanced",
  },
  {
    id: "bench",
    nameKey: "exBenchName",
    targetKey: "exBenchTarget",
    icon: Activity,
    level: "intermediate",
  },
  {
    id: "kettlebell",
    nameKey: "exKettlebellName",
    targetKey: "exKettlebellTarget",
    icon: Flame,
    level: "beginner",
  },
  {
    id: "pullup",
    nameKey: "exPullupName",
    targetKey: "exPullupTarget",
    icon: PersonStanding,
    level: "intermediate",
  },
  {
    id: "farmer",
    nameKey: "exFarmerName",
    targetKey: "exFarmerTarget",
    icon: HeartPulse,
    level: "beginner",
  },
];

export const gymFeatures: GymFeature[] = [
  {
    id: "programs",
    titleKey: "why1Title",
    descKey: "why1Desc",
    icon: Compass,
  },
  {
    id: "technique",
    titleKey: "why2Title",
    descKey: "why2Desc",
    icon: ShieldCheck,
  },
  {
    id: "recovery",
    titleKey: "why3Title",
    descKey: "why3Desc",
    icon: Waves,
  },
  {
    id: "nutrition",
    titleKey: "why4Title",
    descKey: "why4Desc",
    icon: Salad,
  },
];

export const gymSchedule: GymSlot[] = [
  {
    time: "07:00",
    labelKey: "scheduleSlotMorning",
    classes: ["strength", "open", "strength", "conditioning", "strength", "conditioning"],
  },
  {
    time: "12:30",
    labelKey: "scheduleSlotMidday",
    classes: ["mobility", "conditioning", "mobility", "mobility", "open", "mobility"],
  },
  {
    time: "18:30",
    labelKey: "scheduleSlotEvening",
    classes: ["conditioning", "strength", "open", "strength", "conditioning", "strength"],
  },
];

export const gymScheduleDays = [
  "scheduleDayMon",
  "scheduleDayTue",
  "scheduleDayWed",
  "scheduleDayThu",
  "scheduleDayFri",
  "scheduleDaySat",
];

export const gymClassLabelKeys: Record<GymClassId, string> = {
  strength: "scheduleClassStrength",
  conditioning: "scheduleClassConditioning",
  mobility: "scheduleClassMobility",
  open: "scheduleClassOpen",
};

export const gymStories: GymStory[] = [
  {
    id: "aysel",
    quoteKey: "stories1Quote",
    nameKey: "stories1Name",
    roleKey: "stories1Role",
    initials: "AR",
  },
  {
    id: "elvin",
    quoteKey: "stories2Quote",
    nameKey: "stories2Name",
    roleKey: "stories2Role",
    initials: "EM",
  },
  {
    id: "murad",
    quoteKey: "stories3Quote",
    nameKey: "stories3Name",
    roleKey: "stories3Role",
    initials: "MS",
  },
];

export const gymVenues: GymVenue[] = [
  {
    id: "ironhouse",
    nameKey: "venueIronName",
    descKey: "venueIronDesc",
    image: unsplash("1593079831268-3381b0db4a77", 1600),
    rating: 4.8,
    featureKeys: ["feat247", "featSauna", "featPool"],
  },
  {
    id: "pulse",
    nameKey: "venuePulseName",
    descKey: "venuePulseDesc",
    image: unsplash("1546483875-ad9014c88eba", 1600),
    rating: 4.6,
    featureKeys: ["featClasses", "featCardio", "featParking"],
  },
  {
    id: "vertex",
    nameKey: "venueVertexName",
    descKey: "venueVertexDesc",
    image: unsplash("1571902943202-507ec2618e8f", 1600),
    rating: 4.9,
    featureKeys: ["featPlatforms", "featCoaching", "featRecovery"],
  },
];
