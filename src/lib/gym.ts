import {
  Backpack, CalendarDays, Dumbbell, MapPin, Pill, Shirt,
  type LucideIcon,
} from "lucide-react";
import type { Plan } from "./worlds";

/**
 * The registered-surface gym app (/<locale>/gym) — UI config + pure helpers.
 * All DATA (halls, equipment, trainers, stores, products, workouts) lives in
 * Supabase Postgres behind the merged backend — see GymContent below and
 * lib/api.ts → getGymContent() (raw, key-carrying) plus getGymAppContent()
 * (per-locale resolved, page-facing).
 */

/* ── Tabs ────────────────────────────────────────────────────────────────── */

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

/* ── Stores (the "where to buy" side of the shop tabs) ──────────────────── */

export type StoreKind = "online" | "store" | "pharmacy";

export type StoreRef = {
  slug: string;
  name: string;
  kind: StoreKind;
  url: string;
  /** v3.4: ISO 3166-1 alpha-2 country tag — the account location
   *  preference (az) filters on this; undefined rows count as AZ. */
  country?: string | null;
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
  price: [number | null, number | null];
  /** Product photo — falls back to the icon chip when null. */
  image: string | null;
  /** Where to buy: STORES slug + typical price there (₼). */
  at: { store: string; price: number | null }[];
};

/** Cheapest offer price — drives the "best price" row highlight and the
 *  sort-by-cheapest order. Infinity when there are no offers. */
export const minPriceOf = (offers: { price: number }[]): number =>
  offers.reduce((min, a) => Math.min(min, a.price), Number.POSITIVE_INFINITY);

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
  rating: number | null;
  featureKeys: string[];
  address: string;
  hours: string;
  /** Day-pass price in ₼. */
  dayPrice: number | null;
  /** Equipment codes (gym_equipment registry order). */
  equipment: string[];
  trainers: HallTrainer[];
  /** v3.4: ISO 3166-1 alpha-2 country tag (location filter); undefined = AZ. */
  country?: string | null;
};

/* ── Workout sessions (the plan catalog's day details) ─────────────────── */

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

/* ── The full gym content payload (raw, key-carrying) ──────────────────── */

export type GymContent = {
  plans: Plan[];
  places: GymPlace[];
  stores: Record<string, StoreRef>;
  /** gym_equipment registry: code → gymApp.hallEq.<code> label key. */
  equipmentRegistry: Record<string, { nameKey: string }>;
  /** gym_trainer_specs registry: code → gymApp.hallSpec.<code> label key. */
  trainerSpecs: Record<string, { nameKey: string }>;
  catalog: Record<string, Product[]>;
  exercises: Record<string, ExerciseRef>;
  workouts: Record<string, WorkoutDay[]>;
  planWeeks: Record<string, { week: number; total: number }>;
};

/* ── Message-tree helpers (plain, framework-free) ──────────────────────── */

export type MessageTree = Record<string, unknown>;

/** Resolve a dot-path ("equipment.barbell", "hallEq.powerRacks") inside a
 *  nested message tree; null when the path does not exist (or holds an
 *  object). Used by the server-side resolvers so raw keys never leak. */
export function msgPath(tree: MessageTree | undefined, key: string): string | null {
  if (!tree) return null;
  let node: unknown = tree;
  for (const part of key.split(".")) {
    if (!node || typeof node !== "object" || Array.isArray(node)) return null;
    node = (node as MessageTree)[part];
  }
  return typeof node === "string" ? node : null;
}

/** Fill `{param}` placeholders of a message template with named values. */
export function fillMsg(tpl: string, params: Record<string, string | number>): string {
  return tpl.replace(/\{(\w+)\}/g, (m, name: string) =>
    name in params ? String(params[name]) : m);
}

/* ── The page-facing resolved payload (plain strings, serializable) ─────── */

export type GymAppTrainer = { name: string; spec: string; years: number };

export type GymAppPlace = {
  id: string;
  name: string;
  desc: string;
  image: string;
  rating: number | null;
  address: string;
  hours: string;
  dayPrice: number | null;
  /** Resolved amenity labels (gymHome.feat*). */
  features: string[];
  /** Resolved equipment labels, registry order. */
  equipment: string[];
  trainers: GymAppTrainer[];
  /** v3.4: ISO 3166-1 alpha-2 country tag (location filter); undefined = AZ. */
  country?: string | null;
};

export type GymAppStore = {
  slug: string;
  name: string;
  kind: StoreKind;
  kindLabel: string;
  url: string;
  /** v3.4: ISO 3166-1 alpha-2 country tag (location filter); undefined = AZ. */
  country?: string | null;
};

export type GymAppOffer = {
  store: string;
  storeName: string;
  kindLabel: string;
  url: string;
  price: number;
};

export type GymAppProduct = {
  id: string;
  /** Product category — also the gymApp.<cat>.<slug> message namespace. */
  cat: string;
  name: string;
  brand: string;
  price: [number, number];
  image: string;
  offers: GymAppOffer[];
};

export type GymAppExercise = {
  code: string;
  name: string;
  target: string;
  guide: string;
};

export type GymAppPlanExercise = {
  name: string;
  sets: number;
  /** Final localized prescription, e.g. "8–12 təkrar" or "5 dəq". */
  reps: string;
  rest: number;
};

export type GymAppPlanDay = {
  /** 1 = Monday … 7 = Sunday. */
  day: number;
  exercises: GymAppPlanExercise[];
};

export type GymAppPlan = {
  id: string;
  name: string;
  desc: string;
  image: string;
  level: string | null;
  /** Localized meta tags, e.g. "3 days/week", "8-week plan". */
  meta: string[];
  week: number | null;
  total: number | null;
  days: GymAppPlanDay[];
};

/** Everything the İdman surface renders, with every message key already
 *  resolved into the request locale — plain text down to the client. */
export type GymAppContent = {
  locale: string;
  halls: GymAppPlace[];
  stores: GymAppStore[];
  products: GymAppProduct[];
  exercises: Record<string, GymAppExercise>;
  plans: GymAppPlan[];
};
