import { BookOpen, Brain, Dumbbell, Salad, type LucideIcon } from "lucide-react";
import type { WorldSlug } from "./worlds";

/**
 * The four product sections in display order (Gym, Diet, Psychology, Books).
 * `id` is the copy key under `sections.*` / `welcomePage.modules.cards.*`.
 *
 * Two addresses per section: `welcomeHref` is the PUBLIC marketing page
 * under /welcome/<welcomeSlug> — named after the tab visitors see
 * (gym, diet, psychology, books) — linked from the welcome surface and
 * open to everyone. `href` is the registered-user app page at /<slug>
 * (the app-surface tabs — their content will be written later).
 */
export type SectionId = "sport" | "diet" | "psikoloji" | "kitab";

/** Public URL slugs under /welcome/ — the names shown in the tab bar. */
export type WelcomeSlug = "gym" | "diet" | "psychology" | "books";

export type Section = {
  id: SectionId;
  /** Content world behind the section (app-surface slug). */
  slug: WorldSlug;
  /** Public marketing-page slug under /welcome/. */
  welcomeSlug: WelcomeSlug;
  href: `/${WorldSlug}`;
  welcomeHref: `/welcome/${WelcomeSlug}`;
  icon: LucideIcon;
  color: string;
};

export const sections: readonly Section[] = [
  { id: "sport", slug: "gym", welcomeSlug: "gym", href: "/gym", welcomeHref: "/welcome/gym", icon: Dumbbell, color: "#7B2D3B" },
  { id: "diet", slug: "diet", welcomeSlug: "diet", href: "/diet", welcomeHref: "/welcome/diet", icon: Salad, color: "#5F7F52" },
  { id: "psikoloji", slug: "meditation", welcomeSlug: "psychology", href: "/meditation", welcomeHref: "/welcome/psychology", icon: Brain, color: "#7D8F6D" },
  { id: "kitab", slug: "library", welcomeSlug: "books", href: "/library", welcomeHref: "/welcome/books", icon: BookOpen, color: "#8A6A45" },
] as const;

export const sectionById = (id: SectionId) => sections.find((s) => s.id === id)!;
export const sectionBySlug = (slug: WorldSlug) => sections.find((s) => s.slug === slug)!;
export const sectionByWelcomeSlug = (slug: WelcomeSlug) =>
  sections.find((s) => s.welcomeSlug === slug)!;

/** Browser-storage keys. */
export const THEME_KEY = "pl-theme";
