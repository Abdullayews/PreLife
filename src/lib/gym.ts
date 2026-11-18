import {
  Backpack, CalendarDays, Dumbbell, MapPin, Pill, Shirt,
  type LucideIcon,
} from "lucide-react";
import type { Plan, Slot } from "./worlds";

/**
 * The registered-surface gym app (/<locale>/gym) — UI config + pure helpers.
 * All DATA (halls, equipment, trainers, stores, products, workouts) lives in
 * Supabase Postgres behind the Rust API — see GymContent below and
 * lib/api.ts → getGymContent().
 */

export type GymTabId =
  | "plan" | "gyms" | "equipment" | "supplements" | "accessories" | "clothing";

export type GymTab = { id: GymTabId; icon: LucideIcon };

/** Display order matters — the rail lists these top to bottom. */
export const GYM_TABS: readonly GymTab[] = [
  { id: "plan", icon: CalendarDays },
  { id: "gyms", icon: MapPin },
  { id: "equipment", icon: Dumbbell },
  { id: "supplements", icon: Pill },
  { id: "accessories", icon: Backpack },
  { id: "clothing", icon: Shirt },
] as const;

export const isGymTabId = (v: string): v is GymTabId =>
  GYM_TABS.some((t) => t.id === v);

export const SHOP_TAB_IDS = ["equipment", "supplements", "accessories", "clothing"] as const;
export type ShopTabId = (typeof SHOP_TAB_IDS)[number];

export const isShopTab = (id: GymTabId): id is ShopTabId =>
  (SHOP_TAB_IDS as readonly string[]).includes(id);

/* ── Stores (the "where to buy" side of the shop tabs) ────────────────── */

export type StoreKind = "online" | "store" | "pharmacy";

export type StoreRef = {
  slug: string;
  name: string;
  kind: StoreKind;
  url: string;
};

/* ── Products (shop tabs) ──────────────────────────────────────────────── */

export type Product = {
  id: string;
  /** gymApp.<tab>.<nameKey> — resolved server-side. */
  nameKey: string;
  /** Proper noun, shown as-is. */
  brand: string;
  /** Lucide icon name (lib/icons.ts registry). */
  icon: string;
  /** Typical price window in ₼. */
  price: [number, number];
  /** Product photo — falls back to the icon chip when null. */
  image: string | null;
  /** Where to buy: STORES slug + typical price there (₼). */
  at: { store: string; price: number }[];
};

/** Cheapest store price for a product — drives the "best price" row
 *  highlight and the sort-by-cheapest order. */
export const minPriceOf = (p: Product): number =>
  p.at.reduce((min, a) => Math.min(min, a.price), Number.POSITIVE_INFINITY);

/* ── Partner gyms (zallar) ─────────────────────────────────────────────── */

export type HallTrainer = {
  name: string;
  spec: string;
  years: number;
};

export type GymPlace = {
  id: string;
  /** Which namespace the name/desc keys live in. */
  ns: "gymHome" | "gymApp";
  nameKey: string;
  descKey: string;
  image: string;
  rating: number;
  featureKeys: string[];
  address: string;
  hours: string;
  /** Day-pass price in ₼. */
  dayPrice: number;
  /** gymApp.hallEq.<code> message keys — the hall's equipment floor list. */
  equipment: string[];
  trainers: HallTrainer[];
};

/* ── Workout sessions (the "İdməna başla" guide) ───────────────────────── */

/** The prescription of one planned exercise. Sets/rest are numbers;
 *  `reps` is a structured union the UI renders through message
 *  templates so nothing is hardcoded in a single locale. */
export type Reps =
  | { t: "reps"; a: number; b?: number }   // 8–12 / 12 təkrar
  | { t: "time"; a: number }               // N minutes
  | { t: "secs"; a: number }               // N seconds
  | { t: "each"; a: number };              // N per side

export type PlannedExercise = {
  ex: string;
  sets: number;
  reps: Reps;
  rest: number;
};

export type WorkoutDay = { day: number; exercises: PlannedExercise[] };

export type ExerciseRef = { nameKey: string; targetKey: string; guideKey: string };

/** gymApp message key + ICU values for a Reps union. */
export const repsLabelKey = (r: Reps): string =>
  r.t === "reps" ? (r.b === undefined ? "repSingle" : "repRange")
  : r.t === "time" ? "repTime"
  : r.t === "secs" ? "repSecs"
  : "repEach";

/** The workout scheduled for a weekday, or null on rest days. */
export const workoutFor = (
  workouts: Record<string, WorkoutDay[]>,
  planId: string,
  weekday: number,
): WorkoutDay | null =>
  (workouts[planId] ?? []).find((d) => d.day === weekday) ?? null;

/* ── The full gym content payload (Rust API shape) ─────────────────────── */

export type GymContent = {
  plans: Plan[];
  schedule: { slots: Slot[]; cellKeys: Record<string, string> };
  places: GymPlace[];
  stores: Record<string, StoreRef>;
  catalog: Record<ShopTabId, Product[]>;
  exercises: Record<string, ExerciseRef>;
  workouts: Record<string, WorkoutDay[]>;
  planWeeks: Record<string, { week: number; total: number }>;
};
