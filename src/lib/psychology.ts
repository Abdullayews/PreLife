import type { LucideIcon } from "lucide-react";
import {
  Baby, BrainCircuit, Flower2, Heart, HeartHandshake, House,
  UsersRound, Wind,
} from "lucide-react";
import type { Item, Place, Plan } from "./worlds";

/**
 * Psychology (/meditation) app — pure functions + types. All DATA
 * (psychologist profiles, media, quizzes, rotation pools) lives in Supabase
 * Postgres behind the Rust API — see MeditationContent and lib/api.ts →
 * getMeditationContent().
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
  /** Locale tags the psychologist consults in. */
  languages: string[];
  /** Weekly recurring working blocks (Baku local hours). */
  availability: AvailabilityBlock[];
  initials: string;
  since: number;
  eduKey: string;
  certKeys: string[];
  rulesKey: string;
  /** v3.4: ISO 3166-1 alpha-2 country tag — the account location
   *  preference (az) filters on this; undefined rows count as AZ. */
  country?: string | null;
};

export const psyBySlug = (list: Psychologist[], slug: string) =>
  list.find((p) => p.slug === slug);

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
export function fitAll(list: Psychologist[], f: FitFilter): FitResult[] {
  const scored = list.map((p) => fitOne(p, f));
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

/* ── Mood / quizzes ─────────────────────────────────────────────────────── */

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

export const QUIZ_QUESTION_COUNT = 3;   // per quiz
export const QUIZ_OPTION_COUNT = 4;     // per question, scored 0–3
export const QUIZ_MAX_SCORE = QUIZ_QUESTION_COUNT * (QUIZ_OPTION_COUNT - 1); // 9

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

export const mediaById = (list: MediaResource[], id: string) =>
  list.find((m) => m.id === id);

/* ── Day-rotated copy (quotes, journal prompts) ─────────────────────────── */

/** Deterministic pick: UTC day index mod the pool length — every locale
 *  shows the same item on the same day. */
export const dayRotated = (keys: string[]): string =>
  keys[Math.floor(Date.now() / 86_400_000) % keys.length]!;

/* ── The full meditation content payload (Rust API shape) ───────────────── */

export type QuizRef = { id: string; questions: number };

export type MeditationContent = {
  plans: Plan[];
  sessions: Item[];
  mentors: Place[];
  psychologists: Psychologist[];
  media: MediaResource[];
  tdb: MediaResource[];
  quizzes: QuizRef[];
  moodTags: string[];
  quoteKeys: string[];
  promptKeys: string[];
};

/* Icon used by QUIZZES on the client (quiz ids are stable). */
export const QUIZ_ICONS: Record<string, LucideIcon> = {
  stress: BrainCircuit, sleep: Wind, focus: Flower2,
};
