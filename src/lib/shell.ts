import { BookOpen, Brain, Dumbbell, Salad, type LucideIcon } from "lucide-react";
import type { WorldSlug } from "./worlds";

/**
 * THE single naming registry for the four product sections. Every route,
 * slug, message key and anchor that identifies a section is derived from
 * this table — to rename anything, change it here (and only here).
 *
 * One term per section everywhere (routes, ids, message keys):
 * gym, diet, meditation, library. The user-visible LABELS may differ
 * (e.g. the meditation section is shown as "Psychology" / "Psixologiya"
 * / "Психология") — those live in messages/*.json under sections.<id>.name
 * and can be re-titled without touching routes.
 *
 * Two addresses per section: `welcomeHref` is the PUBLIC marketing page
 * under /welcome/<welcomeSlug> (welcomeSlug === slug since the unify —
 * the old /welcome/psychology and /welcome/books addresses 301 to the
 * new ones from src/proxy.ts), linked from the welcome surface and open
 * to everyone. `href` is the registered-user app page at /<slug>.
 */
export type SectionId = "gym" | "diet" | "meditation" | "library";

/** Public URL slugs under /welcome/ — same terms as the app routes. */
export type WelcomeSlug = "gym" | "diet" | "meditation" | "library";

export type Section = {
  id: SectionId;
  /** Content world behind the section (app-surface slug — same term). */
  slug: WorldSlug;
  /** Public marketing-page slug under /welcome/ — same term. */
  welcomeSlug: WelcomeSlug;
  href: `/${WorldSlug}`;
  welcomeHref: `/welcome/${WelcomeSlug}`;
  icon: LucideIcon;
  color: string;
};

export const sections: readonly Section[] = [
  { id: "gym", slug: "gym", welcomeSlug: "gym", href: "/gym", welcomeHref: "/welcome/gym", icon: Dumbbell, color: "#7B2D3B" },
  { id: "diet", slug: "diet", welcomeSlug: "diet", href: "/diet", welcomeHref: "/welcome/diet", icon: Salad, color: "#5F7F52" },
  { id: "meditation", slug: "meditation", welcomeSlug: "meditation", href: "/meditation", welcomeHref: "/welcome/meditation", icon: Brain, color: "#7D8F6D" },
  { id: "library", slug: "library", welcomeSlug: "library", href: "/library", welcomeHref: "/welcome/library", icon: BookOpen, color: "#8A6A45" },
] as const;

export const sectionById = (id: SectionId) => sections.find((s) => s.id === id)!;
export const sectionBySlug = (slug: WorldSlug) => sections.find((s) => s.slug === slug)!;
export const sectionByWelcomeSlug = (slug: WelcomeSlug) =>
  sections.find((s) => s.welcomeSlug === slug)!;

/** Browser-storage keys. The theme key is owned by lib/consent.ts (the
 *  storage/persistence module) and re-exported here for convenience. */
export { THEME_KEY } from "./consent";
