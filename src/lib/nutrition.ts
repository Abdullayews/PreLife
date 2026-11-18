import {
  ChefHat, Fish, Flame, HeartPulse, Leaf, Salad, Soup, Wheat,
  type LucideIcon,
} from "lucide-react";
import { worlds } from "./worlds";

/**
 * The nutrition (/diet) app — structure layer, following the worlds.ts
 * convention: this file holds ONLY typed data and numbers. Every
 * visible string is a message key into messages/*.json (namespace
 * "dietApp" — the nutrition one; psychology lives in psychApp).
 *
 * Meal plans, recipes and venues themselves come from worlds.diet
 * (dietHome message keys shared with the welcome page); this file adds
 * the app-side details: recipe ingredients, cooking times, calories
 * and venue addresses/hours.
 */

export const dietPlans = worlds.diet.plans;
export const dietRecipes = worlds.diet.items;
export const dietPlaces = worlds.diet.places;

/* ── Recipe details ─────────────────────────────────────────────────────── */

export type RecipeDetail = {
  /** Recipe id in worlds.diet.items. */
  id: string;
  /** Cooking minutes. */
  minutes: number;
  /** kcal per serving. */
  kcal: number;
  /** Ingredient message keys (dietApp.ing.<key>). */
  ingredients: string[];
};

export const RECIPE_DETAILS: Record<string, RecipeDetail> = {
  "protein-bowl": {
    id: "protein-bowl", minutes: 20, kcal: 520,
    ingredients: ["chicken", "rice", "avocado", "egg", "yogurt"],
  },
  "market-salad": {
    id: "market-salad", minutes: 15, kcal: 320,
    ingredients: ["greens", "tomato", "cucumber", "oliveoil", "feta"],
  },
  "lentil-soup": {
    id: "lentil-soup", minutes: 35, kcal: 380,
    ingredients: ["lentil", "carrot", "onion", "cumin", "lemon"],
  },
  salmon: {
    id: "salmon", minutes: 25, kcal: 460,
    ingredients: ["salmon", "potato", "asparagus", "butter", "dill"],
  },
  oats: {
    id: "oats", minutes: 10, kcal: 340,
    ingredients: ["oats", "milk", "banana", "honey", "walnut"],
  },
  "chefs-plate": {
    id: "chefs-plate", minutes: 45, kcal: 610,
    ingredients: ["beef", "quinoa", "pepper", "garlic", "herbs"],
  },
};

/* ── Venue details ──────────────────────────────────────────────────────── */

export type VenueDetail = {
  id: string;
  /** Street address — proper noun, shown as-is in every locale. */
  address: string;
  /** Opening hours — same digits in all locales, no translation. */
  hours: string;
  /** Maps search label. */
  mapQuery: string;
};

export const VENUE_DETAILS: Record<string, VenueDetail> = {
  "green-market": { id: "green-market", address: "Səbail, Badamdar şossesi", hours: "08:00–20:00", mapQuery: "Badamdar Bazar Bakı" },
  "fit-kitchen": { id: "fit-kitchen", address: "Nərimanov, Ə. Rəcəbli küç.", hours: "10:00–22:00", mapQuery: "Fit Kitchen Bakı" },
  "nourish-bar": { id: "nourish-bar", address: "İçərişəhər, Kichik Qala küç.", hours: "09:00–23:00", mapQuery: "Nourish Bar Bakı" },
};

/* ── Day-rotated picks ─────────────────────────────────────────────────── */

/** Deterministic pick of the day: UTC day index mod the pool length —
 *  every locale shows the same recipe on the same day. */
export const recipeOfTheDay = (): string =>
  dietRecipes[Math.floor(Date.now() / 86_400_000) % dietRecipes.length]!.id;

/** Icon registry for recipe cards (mirrors worlds.diet.items order). */
export const RECIPE_ICONS: Record<string, LucideIcon> = {
  "protein-bowl": HeartPulse, "market-salad": Leaf, "lentil-soup": Soup,
  salmon: Fish, oats: Wheat, "chefs-plate": ChefHat,
};

export const DIET_ICONS = { salad: Salad, flame: Flame };
