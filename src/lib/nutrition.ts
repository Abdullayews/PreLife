import {
  ChefHat, Fish, Flame, HeartPulse, Leaf, Salad, Soup, Wheat,
  type LucideIcon,
} from "lucide-react";
import type { Item, Place, Plan } from "./worlds";

/**
 * The nutrition (/diet) app — icon registries + types. All DATA (meal
 * plans, recipes, venues and their details) lives in Supabase Postgres
 * behind the Rust API — see DietContent and lib/api.ts → getDietContent().
 */

export type RecipeDetail = {
  id: string;
  minutes: number;
  kcal: number;
  /** Ingredient message keys (dietApp.ing.<key>). */
  ingredients: string[];
};

export type VenueDetail = {
  id: string;
  /** Street address — proper noun, shown as-is in every locale. */
  address: string;
  /** Opening hours — same digits in all locales, no translation. */
  hours: string;
  /** Maps search label. */
  mapQuery: string;
};

/** A diet venue (world_places row) carrying its v3.4 country tag — the
 *  account location preference (az) filters on this; undefined rows
 *  count as AZ. */
export type DietPlace = Place & { country?: string | null };

export type DietContent = {
  plans: Plan[];
  recipes: Item[];
  places: DietPlace[];
  recipeDetails: Record<string, RecipeDetail>;
  venueDetails: Record<string, VenueDetail>;
};

/** Deterministic pick of the day: UTC day index mod the pool length —
 *  every locale shows the same recipe on the same day. */
export const recipeOfTheDay = (recipes: Item[]): string =>
  recipes[Math.floor(Date.now() / 86_400_000) % recipes.length]!.id;

/** Icon registry for recipe cards (id → Lucide icon). */
export const RECIPE_ICONS: Record<string, LucideIcon> = {
  "protein-bowl": HeartPulse, "market-salad": Leaf, "lentil-soup": Soup,
  salmon: Fish, oats: Wheat, "chefs-plate": ChefHat,
};

export const DIET_ICONS = { salad: Salad, flame: Flame };
