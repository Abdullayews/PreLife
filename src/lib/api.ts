import { headers } from "next/headers";
import type { WorldsResponse } from "./worlds";
import type { GymContent } from "./gym";
import type { DietContent } from "./nutrition";
import type { LibraryContent } from "./library";
import type { MeditationContent } from "./psychology";
import {
  dietCatalog,
  gymCatalog,
  libraryCatalog,
  meditationCatalog,
  subscriptionCatalog,
  worldsCatalog,
} from "./server/content";
import {
  bookingsList,
  journalList,
  moodList,
  overview,
  scheduleWindow,
} from "./server/psych-data";
import { currentSessionFromHeaders } from "./server/session";

/**
 * Server-side data layer — the merged backend. Every getter runs the
 * same assembly code the /api routes use (src/lib/server/*), reading
 * Supabase Postgres directly: no HTTP hop, no separate service.
 * Content getters are served from the 60s in-process TTL cache; user
 * data getters resolve the cookie session per request and are never
 * cached.
 */

/* ── Content (public, TTL-cached 60s) ───────────────────────────────────── */

export const getWorlds = () => worldsCatalog() as Promise<WorldsResponse | null>;
export const getGymContent = () => gymCatalog() as Promise<GymContent | null>;
export const getDietContent = () => dietCatalog() as Promise<DietContent | null>;
export const getMeditationContent = () => meditationCatalog() as Promise<MeditationContent | null>;
export const getLibraryContent = () => libraryCatalog() as Promise<LibraryContent | null>;

export type SubscriptionFeatureRow = { id: string; nameKey: string; price: number };
export type SubscriptionTierRow = { id: string; nameKey: string; price: number; features: string[] };
export type SubscriptionContent = {
  features: SubscriptionFeatureRow[];
  tiers: SubscriptionTierRow[];
};
export const getSubscriptionContent = () =>
  subscriptionCatalog() as Promise<SubscriptionContent | null>;

/* ── User data (cookie session, never cached) ───────────────────────────── */

export type JournalEntryRow = {
  id: string; promptKey: string | null; content: string;
  createdAt: string; updatedAt: string;
};
export type MoodRowFull = {
  id: string; date: string; mood: number; energy: number; sleepQ: number;
  tags: string; note: string | null; createdAt: string; updatedAt: string;
};
export type AppointmentRow = {
  id: string; psychologistSlug: string; startAt: string;
  mode: string; price: number; status: string; payment: string; createdAt: string;
};
export type QuizResultRow = {
  id: string; quizId: string; score: number; maxScore: number; createdAt: string;
};

export type JournalData = { entries: JournalEntryRow[]; moods: Pick<MoodRowFull, "date" | "mood" | "energy" | "sleepQ">[] };
export type MoodData = { logs: MoodRowFull[]; quizResults: QuizResultRow[] };
export type BookingsData = { appointments: AppointmentRow[] };
export type ScheduleWindowData = { mine: { startAt: string; psychologistSlug: string }[]; all: { startAt: string; psychologistSlug: string }[] };
export type OverviewData = {
  logs: MoodRowFull[];
  upcoming: AppointmentRow[];
  weekSeconds: number;
  doneSessions: number;
};

/** Resolve the cookie session, run the query, and flatten any failure to
 * null — pages render their signed-out / empty states gracefully. */
async function withUser<T>(fn: (user: { id: string; email: string; name: string | null }) => Promise<T>): Promise<T | null> {
  try {
    const h = await headers();
    const cs = await currentSessionFromHeaders(h);
    if (!cs) return null;
    return await fn(cs.user);
  } catch {
    return null;
  }
}

export const getJournalData = () => withUser(journalList) as Promise<JournalData | null>;
export const getMoodData = () => withUser(moodList) as Promise<MoodData | null>;
export const getBookings = () => withUser(bookingsList) as Promise<BookingsData | null>;
export const getScheduleWindow = () => withUser(scheduleWindow) as Promise<ScheduleWindowData | null>;
export const getOverview = () => withUser(overview) as Promise<OverviewData | null>;
