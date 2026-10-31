import { BookOpen, Brain, Dumbbell, Salad, type LucideIcon } from "lucide-react";
import type { WorldSlug } from "./worlds";

/**
 * The four product sections in display order (Gym, Diet, Psychology, Books).
 * `id` is the copy key under `sections.*` / `welcomePage.modules.cards.*`;
 * `slug` is the route and the content world behind it.
 */
export type SectionId = "sport" | "diet" | "psikoloji" | "kitab";

export type Section = {
  id: SectionId;
  slug: WorldSlug;
  href: `/${WorldSlug}`;
  icon: LucideIcon;
  color: string;
};

export const sections: readonly Section[] = [
  { id: "sport", slug: "gym", href: "/gym", icon: Dumbbell, color: "#7B2D3B" },
  { id: "diet", slug: "diet", href: "/diet", icon: Salad, color: "#5F7F52" },
  { id: "psikoloji", slug: "meditation", href: "/meditation", icon: Brain, color: "#7D8F6D" },
  { id: "kitab", slug: "library", href: "/library", icon: BookOpen, color: "#8A6A45" },
] as const;

export const sectionById = (id: SectionId) => sections.find((s) => s.id === id)!;
export const sectionBySlug = (slug: WorldSlug) => sections.find((s) => s.slug === slug)!;

/** Browser-storage keys — kept identical to the previous build. */
export const ACCOUNT_FLAG = "prelife.account-active";
export const THEME_KEY = "pl-theme";
