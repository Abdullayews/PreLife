import { headers } from "next/headers";
import type { WorldsResponse } from "./worlds";
import type { GymContent } from "./gym";
import type { DietContent } from "./nutrition";
import type { LibraryContent } from "./library";
import type { MeditationContent } from "./psychology";

/**
 * Server-side data layer — every fetch hits the Rust backend (prelife-api,
 * port 3031), which reads Supabase Postgres. Content endpoints are cached
 * by Next's data cache (revalidate) AND by the Rust service's own TTL cache;
 * user-data endpoints forward the request cookies and are never cached.
 */
export const API_BASE = process.env.PRELIFE_API_URL ?? "http://127.0.0.1:3031";

async function apiGet<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/* ── Content (public, cacheable) ─────────────────────────────────────────── */

export const getWorlds = () => apiGet<WorldsResponse>("/api/content/worlds");
export const getGymContent = () => apiGet<GymContent>("/api/content/gym");
export const getDietContent = () => apiGet<DietContent>("/api/content/diet");
export const getMeditationContent = () => apiGet<MeditationContent>("/api/content/meditation");
export const getLibraryContent = () => apiGet<LibraryContent>("/api/content/library");

export type SubscriptionFeatureRow = { id: string; nameKey: string; price: number };
export type SubscriptionTierRow = { id: string; nameKey: string; price: number; features: string[] };
export type SubscriptionContent = {
  features: SubscriptionFeatureRow[];
  tiers: SubscriptionTierRow[];
};
export const getSubscriptionContent = () => apiGet<SubscriptionContent>("/api/content/subscription");

/* ── User data (cookie-forwarded, no-store) ──────────────────────────────── */

async function apiGetUser<T>(path: string): Promise<T | null> {
  try {
    const h = await headers();
    const cookie = h.get("cookie");
    const res = await fetch(`${API_BASE}${path}`, {
      cache: "no-store",
      headers: cookie ? { cookie } : undefined,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

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

export const getJournalData = () => apiGetUser<JournalData>("/api/psych/journal");
export const getMoodData = () => apiGetUser<MoodData>("/api/psych/mood");
export const getBookings = () => apiGetUser<BookingsData>("/api/psych/bookings");
export const getScheduleWindow = () => apiGetUser<ScheduleWindowData>("/api/psych/schedule-window");
export const getOverview = () => apiGetUser<OverviewData>("/api/psych/overview");
