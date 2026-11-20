import { headers } from "next/headers";
import { getMessages } from "next-intl/server";
import type { WorldsResponse } from "./worlds";
import type { GymContent, GymAppContent, GymAppPlan, GymAppPlace, GymAppProduct, GymAppStore, MessageTree } from "./gym";
import { fillMsg, msgPath, repsLabelKey, type Reps } from "./gym";
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

/* ── Account location scope (v3.4) ── */

export type ContentLocation = "global" | "az";

/**
 * Filter content rows by the signed-in user's location choice. "az" keeps
 * only rows tagged country='AZ'; rows without a country tag count as AZ
 * (every seeded row is AZ, and the catalog builders do not all carry the
 * tag through yet). "global", undefined and null return the list
 * unchanged. Pure per-call post-processing — the shared 60s TTL catalogs
 * are never filtered inside the cache.
 */
export function filterByLocation<T extends { country?: string | null }>(
  rows: T[],
  location?: ContentLocation | null,
): T[] {
  if (location !== "az") return rows;
  return rows.filter((r) => (r.country ?? "AZ") === "AZ");
}

/* ── Gym — the page-facing, locale-resolved catalog ─────────────────────── */

/** Render a structured prescription through the gymApp.rep* templates. */
function repsLabel(app: MessageTree, r: Reps): string {
  const tpl = msgPath(app, repsLabelKey(r));
  if (!tpl) return "";
  const params: Record<string, string | number> = {
    count: r.a,
    from: r.a,
    to: r.t === "reps" && r.b !== undefined ? r.b : r.a,
  };
  return fillMsg(tpl, params);
}

/**
 * Resolve the raw gym catalog (key-carrying, TTL-cached, locale-free) into
 * the plain-text shape IdmanApp renders: every name_key/desc_key/guide_key
 * becomes a final translated string in the requested locale, stores are
 * joined into product offers, and the workout-day prescriptions render
 * through the gymApp.rep* templates. Returns null when the content backend
 * is unreachable (pages degrade to ContentUnavailable).
 */
export async function getGymAppContent(
  locale: string,
  location?: ContentLocation | null,
): Promise<GymAppContent | null> {
  const cat = await getGymContent();
  if (!cat) return null;

  const all = (await getMessages({ locale })) as MessageTree;
  const app = (all.gymApp ?? {}) as MessageTree;   // gymApp namespace tree
  const home = (all.gymHome ?? {}) as MessageTree;  // gymHome namespace tree

  const label = (tree: MessageTree, key: string, fallback: string): string =>
    msgPath(tree, key) ?? fallback;

  /* Exercises — code → resolved name/target/guide. */
  const exercises: GymAppContent["exercises"] = {};
  for (const [code, ref] of Object.entries(cat.exercises)) {
    exercises[code] = {
      code,
      name: label(app, ref.nameKey, code),
      target: label(app, ref.targetKey, ""),
      guide: label(app, ref.guideKey, ""),
    };
  }

  /* Halls — name/desc per the row's own namespace, amenities + equipment +
   * trainer specialities through their registries. */
  const eqLabel = (code: string): string => {
    const nameKey = cat.equipmentRegistry[code]?.nameKey;
    return nameKey ? label(app, nameKey, code) : code;
  };
  const specLabel = (code: string): string => {
    const nameKey = cat.trainerSpecs[code]?.nameKey;
    return nameKey ? label(app, nameKey, code) : code;
  };
  const halls: GymAppPlace[] = filterByLocation(cat.places.map((p) => {
    const tree = p.ns === "gymHome" ? home : app;
    return {
      id: p.id,
      name: label(tree, p.nameKey, p.nameKey),
      desc: label(tree, p.descKey, ""),
      image: p.image,
      rating: p.rating,
      address: p.address,
      hours: p.hours,
      dayPrice: p.dayPrice,
      features: p.featureKeys.map((k) => label(home, k, k)),
      equipment: p.equipment.map(eqLabel),
      trainers: p.trainers.map((t) => ({
        name: t.name,
        spec: specLabel(t.spec),
        years: t.years,
      })),
      country: p.country,
    };
  }), location);

  /* Stores — kind labels resolved for the offer rows, filtered by the
   * account location BEFORE the offers join so products never point at
   * a store the user's location choice excludes. */
  const stores: GymAppStore[] = filterByLocation(Object.values(cat.stores).map((s) => ({
    slug: s.slug,
    name: s.name,
    kind: s.kind,
    kindLabel: label(app, `kind_${s.kind}`, s.kind),
    url: s.url,
    country: s.country,
  })), location);
  const storeBySlug = new Map(stores.map((s) => [s.slug, s]));

  /* Products — names resolved per category namespace, offers joined. */
  const products: GymAppProduct[] = [];
  for (const [catId, list] of Object.entries(cat.catalog)) {
    for (const p of list) {
      const offers = p.at.flatMap((a) => {
        const store = storeBySlug.get(a.store);
        if (!store || typeof a.price !== "number") return [];
        return [{
          store: store.slug,
          storeName: store.name,
          kindLabel: store.kindLabel,
          url: store.url,
          price: a.price,
        }];
      });
      products.push({
        id: p.id,
        cat: catId,
        name: label(app, `${catId}.${p.nameKey}`, p.nameKey),
        brand: p.brand,
        price: [p.price[0] ?? 0, p.price[1] ?? 0],
        image: p.image ?? "",
        offers,
      });
    }
  }

  /* Plan catalog — world plans with localized copy, meta tags, progress and
   * the day-by-day workout details (reps rendered through rep* templates). */
  const plans: GymAppPlan[] = cat.plans.map((plan): GymAppPlan => {
    const levelKey = plan.level
      ? `level${plan.level.charAt(0).toUpperCase()}${plan.level.slice(1)}`
      : "";
    const progress = cat.planWeeks[plan.id] ?? null;
    const days = (cat.workouts[plan.id] ?? []).map((d) => ({
      day: d.day,
      exercises: d.exercises.map((pe) => ({
        name: exercises[pe.ex]?.name ?? pe.ex,
        sets: pe.sets,
        reps: repsLabel(app, pe.reps),
        rest: pe.rest,
      })),
    }));
    return {
      id: plan.id,
      name: label(home, plan.nameKey, plan.nameKey),
      desc: label(home, plan.descKey, ""),
      image: plan.image,
      level: levelKey ? label(home, levelKey, plan.level) : null,
      meta: plan.meta
        .filter(([, v]) => typeof v === "number")
        .map(([k, v]) => fillMsg(label(home, k, ""), { count: v })),
      week: progress?.week ?? null,
      total: progress?.total ?? null,
      days,
    };
  });

  return { locale, halls, stores, products, exercises, plans };
}

/** Diet content, with `places` filtered by the account location choice
 *  ("az" keeps only Azerbaijan venues). */
export async function getDietContent(
  location?: ContentLocation | null,
): Promise<DietContent | null> {
  const content = (await dietCatalog()) as DietContent | null;
  if (!content || location !== "az") return content;
  return { ...content, places: filterByLocation(content.places, location) };
}

/** Meditation content, with `psychologists` filtered by the account
 *  location choice ("az" keeps only Azerbaijan psychologists). */
export async function getMeditationContent(
  location?: ContentLocation | null,
): Promise<MeditationContent | null> {
  const content = (await meditationCatalog()) as MeditationContent | null;
  if (!content || location !== "az") return content;
  return {
    ...content,
    psychologists: filterByLocation(content.psychologists, location),
  };
}

/** Library content, with `places` (venues) filtered by the account
 *  location choice ("az" keeps only Azerbaijan venues). */
export async function getLibraryContent(
  location?: ContentLocation | null,
): Promise<LibraryContent | null> {
  const content = (await libraryCatalog()) as LibraryContent | null;
  if (!content || location !== "az") return content;
  return { ...content, places: filterByLocation(content.places, location) };
}

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
