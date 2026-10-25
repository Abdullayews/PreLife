import {
  Bookmark,
  Compass,
  Feather,
  Landmark,
  Lightbulb,
  MessagesSquare,
  Microscope,
  Sparkles,
  Target,
  Timer,
  type LucideIcon,
} from "lucide-react";

/**
 * Library module content (v2, "Paper & Teal" theme).
 * Text lives in messages (namespace `libraryHome`) - this file only holds
 * typed structure, numbers, reading matrices and media URLs.
 */

export type LibraryLevel = "beginner" | "intermediate" | "advanced";

export type LibraryCollection = {
  id: string;
  nameKey: string;
  descKey: string;
  image: string;
  level: LibraryLevel;
  weeks: number;
  minutesPerDay: number;
  books: number;
  featured?: boolean;
};

export type LibraryBook = {
  id: string;
  nameKey: string;
  targetKey: string;
  icon: LucideIcon;
  level: LibraryLevel;
};

export type LibraryVenue = {
  id: string;
  nameKey: string;
  descKey: string;
  image: string;
  rating: number;
  featureKeys: string[];
};

export type LibraryFeature = {
  id: string;
  titleKey: string;
  descKey: string;
  icon: LucideIcon;
};

export type LibraryStory = {
  id: string;
  quoteKey: string;
  nameKey: string;
  roleKey: string;
  initials: string;
};

export type LibraryTrackId = "chapter" | "summary" | "notes" | "free";

export type LibrarySlot = {
  time: string;
  labelKey: string;
  tracks: LibraryTrackId[];
};

const unsplash = (id: string, width: number) =>
  `https://images.unsplash.com/photo-${id}?w=${width}&q=80&auto=format&fit=crop`;

export const libraryHeroImage = unsplash("1507842217343-583bb7270b66", 2400);

/* Hero gallery frames: the warm reading-hall shelves, then the library
   aisle and the opened-book close-up. */
export const libraryHeroImages: string[] = [
  libraryHeroImage,
  unsplash("1481627834876-b7833e8f5570", 2400),
  unsplash("1524995997946-a1c2e315a42f", 2400),
];
export const libraryHeroImagePositions: string[] = [
  "center 45%",
  "center 42%",
  "center 50%",
];

export const libraryCollections: LibraryCollection[] = [
  {
    id: "foundations",
    nameKey: "colFoundationsName",
    descKey: "colFoundationsDesc",
    image: unsplash("1481627834876-b7833e8f5570", 1600),
    level: "beginner",
    weeks: 8,
    minutesPerDay: 15,
    books: 24,
  },
  {
    id: "mind",
    nameKey: "colMindName",
    descKey: "colMindDesc",
    image: unsplash("1512820790803-83ca734da794", 1600),
    level: "intermediate",
    weeks: 12,
    minutesPerDay: 20,
    books: 32,
    featured: true,
  },
  {
    id: "leadership",
    nameKey: "colLeadershipName",
    descKey: "colLeadershipDesc",
    image: unsplash("1456513080510-7bf3a84b82f8", 1600),
    level: "advanced",
    weeks: 10,
    minutesPerDay: 25,
    books: 28,
  },
];

export const libraryBooks: LibraryBook[] = [
  {
    id: "deep-work",
    nameKey: "bookDeepWorkName",
    targetKey: "bookDeepWorkTarget",
    icon: Target,
    level: "beginner",
  },
  {
    id: "atomic-habits",
    nameKey: "bookHabitsName",
    targetKey: "bookHabitsTarget",
    icon: Compass,
    level: "beginner",
  },
  {
    id: "search-meaning",
    nameKey: "bookMeaningName",
    targetKey: "bookMeaningTarget",
    icon: Lightbulb,
    level: "intermediate",
  },
  {
    id: "thinking-fast",
    nameKey: "bookThinkingName",
    targetKey: "bookThinkingTarget",
    icon: Microscope,
    level: "intermediate",
  },
  {
    id: "meditations",
    nameKey: "bookMeditationsName",
    targetKey: "bookMeditationsTarget",
    icon: Landmark,
    level: "advanced",
  },
  {
    id: "flow",
    nameKey: "bookFlowName",
    targetKey: "bookFlowTarget",
    icon: Sparkles,
    level: "advanced",
  },
];

export const libraryFeatures: LibraryFeature[] = [
  {
    id: "curated",
    titleKey: "why1Title",
    descKey: "why1Desc",
    icon: Feather,
  },
  {
    id: "summaries",
    titleKey: "why2Title",
    descKey: "why2Desc",
    icon: Timer,
  },
  {
    id: "circles",
    titleKey: "why3Title",
    descKey: "why3Desc",
    icon: MessagesSquare,
  },
  {
    id: "shelf",
    titleKey: "why4Title",
    descKey: "why4Desc",
    icon: Bookmark,
  },
];

export const librarySchedule: LibrarySlot[] = [
  {
    time: "08:00",
    labelKey: "scheduleSlotCommute",
    tracks: ["summary", "chapter", "summary", "free", "chapter", "chapter"],
  },
  {
    time: "13:00",
    labelKey: "scheduleSlotLunch",
    tracks: ["notes", "summary", "free", "chapter", "summary", "notes"],
  },
  {
    time: "21:00",
    labelKey: "scheduleSlotEvening",
    tracks: ["chapter", "notes", "chapter", "summary", "notes", "free"],
  },
];

export const libraryScheduleDays = [
  "scheduleDayMon",
  "scheduleDayTue",
  "scheduleDayWed",
  "scheduleDayThu",
  "scheduleDayFri",
  "scheduleDaySat",
];

export const libraryTrackLabelKeys: Record<LibraryTrackId, string> = {
  chapter: "scheduleTrackChapter",
  summary: "scheduleTrackSummary",
  notes: "scheduleTrackNotes",
  free: "scheduleTrackFree",
};

export const libraryStories: LibraryStory[] = [
  {
    id: "zohra",
    quoteKey: "stories1Quote",
    nameKey: "stories1Name",
    roleKey: "stories1Role",
    initials: "ZA",
  },
  {
    id: "rashad",
    quoteKey: "stories2Quote",
    nameKey: "stories2Name",
    roleKey: "stories2Role",
    initials: "RG",
  },
  {
    id: "emil",
    quoteKey: "stories3Quote",
    nameKey: "stories3Name",
    roleKey: "stories3Role",
    initials: "EA",
  },
];

export const libraryVenues: LibraryVenue[] = [
  {
    id: "nizami-house",
    nameKey: "venueNizamiName",
    descKey: "venueNizamiDesc",
    image: unsplash("1521587760476-6c12a4b040da", 1600),
    rating: 4.9,
    featureKeys: ["featLending", "featRare", "featQuiet"],
  },
  {
    id: "paper-cup",
    nameKey: "venuePaperCupName",
    descKey: "venuePaperCupDesc",
    image: unsplash("1524578271613-d550eacf6090", 1600),
    rating: 4.7,
    featureKeys: ["featCafe", "featWifi", "featEvents"],
  },
  {
    id: "reading-room",
    nameKey: "venueRoomName",
    descKey: "venueRoomDesc",
    image: unsplash("1568667256549-094345857637", 1600),
    rating: 4.8,
    featureKeys: ["featMembers", "featKids", "featDigital"],
  },
];
