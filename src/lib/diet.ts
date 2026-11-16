import type { LucideIcon } from "lucide-react";
import {
  Baby, BrainCircuit, Flower2, Heart, HeartHandshake, House,
  UsersRound, Wind,
} from "lucide-react";

/**
 * Psychology (/diet) app — structure layer, following the worlds.ts
 * convention: this file holds ONLY typed data, numbers and schedule
 * matrices. Every visible string is a message key into messages/*.json
 * (namespace "dietApp"), so all three locales stay in sync.
 *
 * Psychologist profiles, prices and weekly availability are content, not
 * user data — they live here (and later, when the psychologist cabinet
 * lands, they move into DB rows behind the same keys). The database only
 * stores what the USER creates: appointments, mood logs, quiz results,
 * journal entries and meditation progress (see prisma/schema.prisma).
 */

export type PsySpecialty = "individual" | "couples" | "family" | "child" | "trauma" | "group";
export type PsyFormat = "online" | "office";
export type PsyWeekday = 1 | 2 | 3 | 4 | 5 | 6; // 1 = Monday … 6 = Saturday (Sunday off)

/** Azerbaijan wall-clock runs UTC+4 year-round (no DST since 2016). */
const BAKU_OFFSET_MS = 4 * 60 * 60 * 1000;

/** "YYYY-MM-DD" + 0–23 hour of a given instant in Baku local time. */
export function bakuParts(instant: Date): { date: string; hour: number; weekday: number } {
  const shifted = new Date(instant.getTime() + BAKU_OFFSET_MS);
  const date = shifted.toISOString().slice(0, 10);
  const hour = shifted.getUTCHours();
  const weekday = ((shifted.getUTCDay() + 6) % 7) + 1; // Mon=1 … Sun=7
  return { date, hour, weekday };
}

/** UTC instant of a Baku wall-clock date ("YYYY-MM-DD") + hour. */
export function bakuInstant(date: string, hour: number): Date {
  const shifted = Date.UTC(
    Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)), hour,
  );
  return new Date(shifted - BAKU_OFFSET_MS);
}

/** Day-shift of a date string, used to walk the 14-day booking window. */
export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export type AvailabilityBlock = { day: PsyWeekday; from: number; to: number };

export type Psychologist = {
  slug: string;
  nameKey: string;
  titleKey: string;
  bioKey: string;
  image: string;
  rating: number;
  /** Session fee, AZN per 50-minute session. */
  price: number;
  specialties: PsySpecialty[];
  formats: PsyFormat[];
  /** BCP-47-ish locale tags the psychologist consults in. */
  languages: string[];
  /** Weekly recurring working blocks (Baku local hours). */
  availability: AvailabilityBlock[];
  initials: string;
};

const portrait = (id: string) =>
  `https://images.unsplash.com/photo-${id}?w=640&h=640&q=80&auto=format&fit=crop`;

const banner = (id: string) =>
  `https://images.unsplash.com/photo-${id}?w=1200&h=525&q=80&auto=format&fit=crop`;

export const PSYCHOLOGISTS: Psychologist[] = [
  {
    slug: "aida-k", nameKey: "psyAidaName", titleKey: "psyAidaTitle", bioKey: "psyAidaBio",
    image: portrait("1573497019940-1c28c88b4f3e"), rating: 5.0, price: 80,
    specialties: ["individual", "trauma"], formats: ["online", "office"],
    languages: ["az", "en", "ru"],
    availability: [
      { day: 1, from: 10, to: 14 }, { day: 3, from: 10, to: 14 },
      { day: 5, from: 15, to: 19 },
    ],
    initials: "AİK",
  },
  {
    slug: "leyla-m", nameKey: "psyLeylaName", titleKey: "psyLeylaTitle", bioKey: "psyLeylaBio",
    image: portrait("1573496359142-b8d87734a5a2"), rating: 4.9, price: 50,
    specialties: ["group", "individual"], formats: ["online"],
    languages: ["az", "en"],
    availability: [
      { day: 2, from: 9, to: 13 }, { day: 4, from: 9, to: 13 },
      { day: 6, from: 11, to: 15 },
    ],
    initials: "LM",
  },
  {
    slug: "samir-a", nameKey: "psySamirName", titleKey: "psySamirTitle", bioKey: "psySamirBio",
    image: portrait("1507003211169-0a1dd7228f2d"), rating: 4.8, price: 60,
    specialties: ["individual"], formats: ["online", "office"],
    languages: ["az", "ru"],
    availability: [
      { day: 1, from: 18, to: 21 }, { day: 2, from: 18, to: 21 },
      { day: 4, from: 18, to: 21 },
    ],
    initials: "SƏ",
  },
  {
    slug: "gulshan-h", nameKey: "psyGulshanName", titleKey: "psyGulshanTitle", bioKey: "psyGulshanBio",
    image: portrait("1580489944761-15a19d654956"), rating: 4.9, price: 90,
    specialties: ["couples", "family"], formats: ["office"],
    languages: ["az", "ru"],
    availability: [
      { day: 2, from: 14, to: 19 }, { day: 3, from: 14, to: 19 },
      { day: 5, from: 14, to: 19 },
    ],
    initials: "GH",
  },
  {
    slug: "kamran-y", nameKey: "psyKamranName", titleKey: "psyKamranTitle", bioKey: "psyKamranBio",
    image: portrait("1500648767791-00dcc994a43e"), rating: 4.7, price: 70,
    specialties: ["child", "family"], formats: ["office", "online"],
    languages: ["az"],
    availability: [
      { day: 1, from: 15, to: 19 }, { day: 3, from: 15, to: 19 },
      { day: 6, from: 10, to: 14 },
    ],
    initials: "KY",
  },
  {
    slug: "nariman-q", nameKey: "psyNarimanName", titleKey: "psyNarimanTitle", bioKey: "psyNarimanBio",
    image: portrait("1472099645785-5658abf4ff4e"), rating: 4.8, price: 85,
    specialties: ["trauma"], formats: ["online"],
    languages: ["az", "en", "ru"],
    availability: [
      { day: 2, from: 10, to: 13 }, { day: 4, from: 16, to: 20 },
      { day: 5, from: 10, to: 13 },
    ],
    initials: "NQ",
  },
  {
    slug: "elmira-r", nameKey: "psyElmiraName", titleKey: "psyElmiraTitle", bioKey: "psyElmiraBio",
    image: portrait("1438761681033-6461ffad8d80"), rating: 4.8, price: 75,
    specialties: ["family", "couples"], formats: ["office", "online"],
    languages: ["az", "ru"],
    availability: [
      { day: 3, from: 9, to: 14 }, { day: 4, from: 9, to: 14 },
      { day: 6, from: 11, to: 16 },
    ],
    initials: "ER",
  },
  {
    slug: "rasim-i", nameKey: "psyRasimName", titleKey: "psyRasimTitle", bioKey: "psyRasimBio",
    image: portrait("1519085360753-af0119f7cbe7"), rating: 4.6, price: 55,
    specialties: ["individual", "group"], formats: ["online"],
    languages: ["az", "en"],
    availability: [
      { day: 1, from: 8, to: 12 }, { day: 5, from: 8, to: 12 },
      { day: 6, from: 9, to: 12 },
    ],
    initials: "Rİ",
  },
];

export const psyBySlug = (slug: string) => PSYCHOLOGISTS.find((p) => p.slug === slug);

export const SPECIALTY_ICONS: Record<PsySpecialty, LucideIcon> = {
  individual: Flower2, couples: Heart, family: House,
  child: Baby, trauma: HeartHandshake, group: UsersRound,
};

/* ── Fit search ─────────────────────────────────────────────────────────── */

export type FitFilter = {
  /** Selected weekdays (1–6); empty = any day. */
  days: PsyWeekday[];
  /** Preferred hour window (24h). */
  from: number;
  to: number;
  specialty: PsySpecialty | "any";
  format: PsyFormat | "any";
};

export type FitResult = {
  psy: Psychologist;
  score: number;          // 0–100
  dayHits: number;        // selected days with at least one working block
  hourHits: number;       // days where the hour window also fits
};

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/**
 * Score one psychologist against the user's fit filter. Weights:
 *   days 45 + hours 25 + specialty 15 + format 10 + rating 5.
 * A "perfect" pick works on every selected day inside the requested
 * hours, practices exactly the wanted specialty in the wanted format.
 */
export function fitOne(psy: Psychologist, f: FitFilter): FitResult {
  const wanted = f.days.length > 0 ? f.days : ([1, 2, 3, 4, 5, 6] as PsyWeekday[]);
  const blocksOn = (day: number) => psy.availability.filter((b) => b.day === day);

  let dayHits = 0;
  let hourHits = 0;
  for (const day of wanted) {
    const blocks = blocksOn(day);
    if (blocks.length === 0) continue;
    dayHits += 1;
    if (f.from < f.to && blocks.some((b) => b.from < f.to && b.to > f.from)) hourHits += 1;
  }

  const dayScore = clamp01(dayHits / wanted.length);
  const hourScore = f.from < f.to ? clamp01(hourHits / Math.max(1, dayHits || 1)) : 0.6;
  const specialtyScore = f.specialty === "any"
    ? 0.6
    : psy.specialties.includes(f.specialty) ? 1 : 0;
  const formatScore = f.format === "any"
    ? 0.7
    : psy.formats.includes(f.format) ? 1 : 0;
  const ratingScore = clamp01((psy.rating - 4.5) / 0.5);

  const score = Math.round(
    dayScore * 45 + hourScore * 25 + specialtyScore * 15 + formatScore * 10 + ratingScore * 5,
  );
  return { psy, score, dayHits, hourHits };
}

/** All psychologists scored + sorted most→least suitable; zero-fit
 *  entries (no day overlap at all) are cut when a day filter is active. */
export function fitAll(f: FitFilter): FitResult[] {
  const scored = PSYCHOLOGISTS.map((p) => fitOne(p, f));
  scored.sort((a, b) => b.score - a.score || b.psy.rating - a.psy.rating);
  return f.days.length > 0 ? scored.filter((r) => r.dayHits > 0) : scored;
}

/* ── Booking grid (next 14 days) ────────────────────────────────────────── */

export type SlotState = "free" | "busy" | "mine" | "off";
export type DayColumn = { date: string; weekday: PsyWeekday; slots: { hour: number; state: SlotState }[] };

/**
 * Walks the next `days` days and marks each working hour of the
 * psychologist: free, busy (another user booked), mine (the caller's own
 * booking) or off (no working block). `now` prunes today's past hours.
 */
export function buildSchedule(
  psy: Psychologist,
  now: Date,
  myBookings: { startAt: Date; psychologistSlug: string }[],
  allBookings: { startAt: Date; psychologistSlug: string }[],
  days = 14,
): DayColumn[] {
  const today = bakuParts(now);
  const mineKey = (d: string, h: number) =>
    myBookings.some((b) => b.psychologistSlug === psy.slug && bakuParts(b.startAt).date === d && bakuParts(b.startAt).hour === h);
  const busyKey = (d: string, h: number) =>
    allBookings.some((b) => b.psychologistSlug === psy.slug && bakuParts(b.startAt).date === d && bakuParts(b.startAt).hour === h);

  const columns: DayColumn[] = [];
  for (let i = 0; i < days; i += 1) {
    const date = shiftDate(today.date, i);
    const weekday = ((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7) + 1 as PsyWeekday;
    const blocks = psy.availability.filter((b) => b.day === weekday);
    const slots: { hour: number; state: SlotState }[] = [];
    const seen = new Set<number>();
    for (const b of blocks) {
      for (let h = b.from; h < b.to; h += 1) {
        if (seen.has(h)) continue;
        seen.add(h);
        let state: SlotState = "free";
        if (i === 0 && h <= today.hour) state = "off"; // today's past hours
        if (mineKey(date, h)) state = "mine";
        else if (busyKey(date, h)) state = "busy";
        slots.push({ hour: h, state });
      }
    }
    slots.sort((a, b) => a.hour - b.hour);
    columns.push({ date, weekday, slots: slots.length > 0 ? slots : [{ hour: -1, state: "off" }] });
  }
  return columns;
}

/* ── Mood self-check ────────────────────────────────────────────────────── */

export const MOOD_TAGS = ["work", "family", "sleep", "health", "money", "social", "self"] as const;
export type MoodTag = (typeof MOOD_TAGS)[number];

export const QUIZZES = [
  { id: "stress", icon: BrainCircuit, questions: 3 },
  { id: "sleep", icon: Wind, questions: 3 },
  { id: "focus", icon: Flower2, questions: 3 },
] as const;

export type QuizId = (typeof QUIZZES)[number]["id"];
export const QUIZ_QUESTION_COUNT = 3;   // per quiz
export const QUIZ_OPTION_COUNT = 4;     // per question, scored 0–3
export const QUIZ_MAX_SCORE = QUIZ_QUESTION_COUNT * (QUIZ_OPTION_COUNT - 1); // 9

/* ── Day-rotated copy (quotes, journal prompts) ─────────────────────────── */

/** Two rotating pools — picked by UTC day index so every locale shows the
 *  same item on the same day. Message keys into "dietApp". */
export const DAILY_QUOTE_KEYS = [
  "quote1", "quote2", "quote3", "quote4", "quote5", "quote6", "quote7",
] as const;

export const JOURNAL_PROMPT_KEYS = [
  "journalPrompt1", "journalPrompt2", "journalPrompt3",
  "journalPrompt4", "journalPrompt5", "journalPrompt6", "journalPrompt7",
] as const;

const dayIndex = () => Math.floor(Date.now() / 86_400_000);

export const todaysQuoteKey = () => DAILY_QUOTE_KEYS[dayIndex() % DAILY_QUOTE_KEYS.length];
export const todaysPromptKey = () => JOURNAL_PROMPT_KEYS[dayIndex() % JOURNAL_PROMPT_KEYS.length];

/** Consecutive-day streak ending today or yesterday, from mood log dates. */
export function moodStreak(dates: string[]): number {
  const set = new Set(dates);
  const today = bakuParts(new Date()).date;
  let cursor = new Date(`${today}T00:00:00Z`);
  if (!set.has(cursor.toISOString().slice(0, 10))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1); // yesterday still keeps the streak alive
    if (!set.has(cursor.toISOString().slice(0, 10))) return 0;
  }
  let streak = 0;
  while (set.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

/* ── Meditation practice media ──────────────────────────────────────────── */

export type MediaResource = {
  id: string;
  kind: "audio" | "video";
  titleKey: string;
  descKey: string;
  minutes: number;
  /** Static asset under /public (generated calm loops). */
  src: string;
  poster: string;
};

export const MEDIA: MediaResource[] = [
  {
    id: "a-morning", kind: "audio", titleKey: "mediaAMorningTitle", descKey: "mediaAMorningDesc",
    minutes: 10, src: "/audio/morning-intention.mp3",
    poster: banner("1506126613408-eca07ce68773"),
  },
  {
    id: "a-box", kind: "audio", titleKey: "mediaABoxTitle", descKey: "mediaABoxDesc",
    minutes: 5, src: "/audio/box-breathing.mp3",
    poster: banner("1545205597-3d9d02c29597"),
  },
  {
    id: "a-body", kind: "audio", titleKey: "mediaABodyTitle", descKey: "mediaABodyDesc",
    minutes: 15, src: "/audio/body-scan.mp3",
    poster: banner("1499209974431-9dddcece7f88"),
  },
  {
    id: "a-evening", kind: "audio", titleKey: "mediaAEveningTitle", descKey: "mediaAEveningDesc",
    minutes: 20, src: "/audio/evening-unwind.mp3",
    poster: banner("1544367567-0f2fcb009e0b"),
  },
  {
    id: "v-intro", kind: "video", titleKey: "mediaVIntroTitle", descKey: "mediaVIntroDesc",
    minutes: 3, src: "/video/breath-visual.mp4",
    poster: banner("1506126613408-eca07ce68773"),
  },
  {
    id: "v-sleep", kind: "video", titleKey: "mediaVSleepTitle", descKey: "mediaVSleepDesc",
    minutes: 4, src: "/video/night-visual.mp4",
    poster: banner("1545389336-cf090694435e"),
  },
];

export const mediaById = (id: string) => MEDIA.find((m) => m.id === id);
