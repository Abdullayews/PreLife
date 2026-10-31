import {
  BedDouble,
  Brain,
  Compass,
  HeartPulse,
  Moon,
  PersonStanding,
  Sun,
  Timer,
  Wind,
  type LucideIcon,
} from "lucide-react";

/**
 * Meditation module content (v2, "Lavender Haze" theme).
 * Text lives in messages (namespace `meditationHome`) - this file only holds
 * typed structure, numbers, session matrices and media URLs.
 */

export type MeditationLevel = "beginner" | "intermediate" | "advanced";

export type MeditationProgram = {
  id: string;
  nameKey: string;
  descKey: string;
  image: string;
  level: MeditationLevel;
  days: number;
  minutesPerDay: number;
  sessionsPerWeek: number;
  featured?: boolean;
};

export type MeditationSession = {
  id: string;
  nameKey: string;
  targetKey: string;
  icon: LucideIcon;
  level: MeditationLevel;
};

export type MeditationMentor = {
  id: string;
  nameKey: string;
  descKey: string;
  image: string;
  rating: number;
  featureKeys: string[];
};

export type MeditationFeature = {
  id: string;
  titleKey: string;
  descKey: string;
  icon: LucideIcon;
};

export type MeditationStory = {
  id: string;
  quoteKey: string;
  nameKey: string;
  roleKey: string;
  initials: string;
};

export type MeditationTrackId = "breathe" | "focus" | "sleep" | "rest";

export type MeditationSlot = {
  time: string;
  labelKey: string;
  tracks: MeditationTrackId[];
};

const unsplash = (id: string, width: number) =>
  `https://images.unsplash.com/photo-${id}?w=${width}&q=80&auto=format&fit=crop`;

export const meditationHeroImage = unsplash("1506126613408-eca07ce68773", 2400);

/* Hero gallery frames: the signature lakeside meditation, then the
   dawn-lit session and the waterside close-up. */
export const meditationHeroImages: string[] = [
  meditationHeroImage,
  unsplash("1545205597-3d9d02c29597", 2400),
  unsplash("1499209974431-9dddcece7f88", 2400),
];
export const meditationHeroImagePositions: string[] = [
  "center 38%",
  "center 45%",
  "center 40%",
];

export const meditationPrograms: MeditationProgram[] = [
  {
    id: "foundations",
    nameKey: "planFoundationsName",
    descKey: "planFoundationsDesc",
    image: unsplash("1544367567-0f2fcb009e0b", 1600),
    level: "beginner",
    days: 7,
    minutesPerDay: 10,
    sessionsPerWeek: 5,
  },
  {
    id: "deep-focus",
    nameKey: "planFocusName",
    descKey: "planFocusDesc",
    image: unsplash("1545389336-cf090694435e", 1600),
    level: "intermediate",
    days: 21,
    minutesPerDay: 15,
    sessionsPerWeek: 6,
    featured: true,
  },
  {
    id: "sleep-reset",
    nameKey: "planSleepName",
    descKey: "planSleepDesc",
    image: unsplash("1499209974431-9dddcece7f88", 1600),
    level: "advanced",
    days: 14,
    minutesPerDay: 20,
    sessionsPerWeek: 7,
  },
];

export const meditationSessions: MeditationSession[] = [
  {
    id: "box-breathing",
    nameKey: "sesBoxName",
    targetKey: "sesBoxTarget",
    icon: Wind,
    level: "beginner",
  },
  {
    id: "body-scan",
    nameKey: "sesBodyName",
    targetKey: "sesBodyTarget",
    icon: PersonStanding,
    level: "beginner",
  },
  {
    id: "morning-intention",
    nameKey: "sesMorningName",
    targetKey: "sesMorningTarget",
    icon: Sun,
    level: "beginner",
  },
  {
    id: "loving-kindness",
    nameKey: "sesKindnessName",
    targetKey: "sesKindnessTarget",
    icon: HeartPulse,
    level: "intermediate",
  },
  {
    id: "walking",
    nameKey: "sesWalkingName",
    targetKey: "sesWalkingTarget",
    icon: Timer,
    level: "intermediate",
  },
  {
    id: "evening-unwind",
    nameKey: "sesEveningName",
    targetKey: "sesEveningTarget",
    icon: Moon,
    level: "advanced",
  },
];

export const meditationFeatures: MeditationFeature[] = [
  {
    id: "science",
    titleKey: "why1Title",
    descKey: "why1Desc",
    icon: Brain,
  },
  {
    id: "short",
    titleKey: "why2Title",
    descKey: "why2Desc",
    icon: Timer,
  },
  {
    id: "sleep",
    titleKey: "why3Title",
    descKey: "why3Desc",
    icon: BedDouble,
  },
  {
    id: "insights",
    titleKey: "why4Title",
    descKey: "why4Desc",
    icon: Compass,
  },
];

export const meditationSchedule: MeditationSlot[] = [
  {
    time: "07:00",
    labelKey: "scheduleSlotMorning",
    tracks: ["breathe", "focus", "breathe", "focus", "breathe", "rest"],
  },
  {
    time: "13:00",
    labelKey: "scheduleSlotMidday",
    tracks: ["focus", "rest", "focus", "breathe", "focus", "breathe"],
  },
  {
    time: "21:00",
    labelKey: "scheduleSlotEvening",
    tracks: ["sleep", "sleep", "rest", "sleep", "sleep", "focus"],
  },
];

export const meditationScheduleDays = [
  "scheduleDayMon",
  "scheduleDayTue",
  "scheduleDayWed",
  "scheduleDayThu",
  "scheduleDayFri",
  "scheduleDaySat",
];

export const meditationTrackLabelKeys: Record<MeditationTrackId, string> = {
  breathe: "scheduleTrackBreathe",
  focus: "scheduleTrackFocus",
  sleep: "scheduleTrackSleep",
  rest: "scheduleTrackRest",
};

export const meditationStories: MeditationStory[] = [
  {
    id: "nargiz",
    quoteKey: "stories1Quote",
    nameKey: "stories1Name",
    roleKey: "stories1Role",
    initials: "NB",
  },
  {
    id: "tahir",
    quoteKey: "stories2Quote",
    nameKey: "stories2Name",
    roleKey: "stories2Role",
    initials: "TI",
  },
  {
    id: "khadija",
    quoteKey: "stories3Quote",
    nameKey: "stories3Name",
    roleKey: "stories3Role",
    initials: "KG",
  },
];

export const meditationMentors: MeditationMentor[] = [
  {
    id: "leyla-m",
    nameKey: "mentorLeylaName",
    descKey: "mentorLeylaDesc",
    image: unsplash("1573496359142-b8d87734a5a2", 1600),
    rating: 4.9,
    featureKeys: ["featMbsr", "featGroup", "featOnline"],
  },
  {
    id: "samir-a",
    nameKey: "mentorSamirName",
    descKey: "mentorSamirDesc",
    image: unsplash("1507003211169-0a1dd7228f2d", 1600),
    rating: 4.8,
    featureKeys: ["featBreathwork", "featOneOnOne", "featCorporate"],
  },
  {
    id: "aida-k",
    nameKey: "mentorAidaName",
    descKey: "mentorAidaDesc",
    image: unsplash("1573497019940-1c28c88b4f3e", 1600),
    rating: 5.0,
    featureKeys: ["featClinical", "featTrauma", "featTeens"],
  },
];
