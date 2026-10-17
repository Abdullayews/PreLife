import { BookOpen, Brain, Dumbbell, Salad, type LucideIcon } from "lucide-react";

export type ModuleDef = {
  /**
   * URL segment -> /{locale}/{slug}. Also the message key in the `nav`
   * (module name) and `modules` (short description) namespaces.
   */
  slug: string;
  icon: LucideIcon;
  /** Module brand color - applied per page in the module's layout.tsx. */
  accent: string;
};

/**
 * Single source of truth for the MVP modules (roadmap Phase 1:
 * Gym, Diet, Meditation, Library).
 *
 * To add a module:
 * 1. add an entry here,
 * 2. copy app/[locale]/(app)/gym/ to a new folder with your slug,
 * 3. add its keys to messages/{en,az,ru}.json (nav + modules namespaces)
 *    - then run: node scripts/check-messages.mjs
 */
export const MODULES: ModuleDef[] = [
  { slug: "gym", icon: Dumbbell, accent: "#16a34a" },
  { slug: "diet", icon: Salad, accent: "#d97706" },
  { slug: "meditation", icon: Brain, accent: "#7c3aed" },
  { slug: "library", icon: BookOpen, accent: "#0d9488" },
];

export function getModule(slug: string): ModuleDef {
  const mod = MODULES.find((m) => m.slug === slug);
  if (!mod) throw new Error(`Unknown module: ${slug}`);
  return mod;
}
