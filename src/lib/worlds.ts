/**
 * The four content worlds (gym, diet, meditation, library) — TYPES ONLY.
 *
 * The data itself now lives in Supabase Postgres and is served by the Rust
 * backend (see lib/api.ts → getWorlds()); the shapes below mirror that API
 * one-to-one. Icons are Lucide icon NAMES (strings) resolved through
 * lib/icons.ts on the client.
 */

export type WorldSlug = "gym" | "diet" | "meditation" | "library";
export type Level = "beginner" | "intermediate" | "advanced";

export type Plan = {
  id: string;
  nameKey: string;
  descKey: string;
  image: string;
  level: Level;
  featured?: boolean;
  /** [message key, ICU {count}] — three facts shown under the plan. */
  meta: [string, number][];
};
export type Item = { id: string; nameKey: string; targetKey: string; icon: string; level: Level };
/** A "what you can do here" capability on the public welcome page. */
export type CanDo = { icon: string; titleKey: string; descKey: string };
export type Place = {
  id: string; nameKey: string; descKey: string; image: string;
  rating: number; featureKeys: string[];
};
export type Slot = { time: string; labelKey: string; cells: string[] };

export type World = {
  slug: WorldSlug;
  ns: string;
  ids: { plans: string; items: string; places: string };
  prefix: { items: string; places: string };
  hero: { images: string[]; positions: string[]; stats: [string, string][] };
  plans: Plan[];
  items: Item[];
  canDo: CanDo[];
  schedule: { slots: Slot[]; cellKeys: Record<string, string> };
  initials: string[];
  places: Place[];
};

export type WorldsResponse = {
  worlds: Record<WorldSlug, World>;
  /** Landing-hero frames: the still-life banner + each world's lead photo. */
  landingFrames: { src: string; pos: string }[];
};

/** Weekday label keys shared by every world's schedule (Mon–Sat). */
export const scheduleDayKeys = [
  "scheduleDayMon", "scheduleDayTue", "scheduleDayWed",
  "scheduleDayThu", "scheduleDayFri", "scheduleDaySat",
] as const;
