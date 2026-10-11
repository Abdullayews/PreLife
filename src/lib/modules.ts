import { BookOpen, Brain, Dumbbell, Salad, type LucideIcon } from "lucide-react";

export type ModuleSlug = "gym" | "diet" | "meditation" | "library";

export type ModuleDefinition = {
  slug: ModuleSlug;
  icon: LucideIcon;
  accent: string;
};

export const modules: ModuleDefinition[] = [
  { slug: "gym", icon: Dumbbell, accent: "#E4572E" },
  { slug: "diet", icon: Salad, accent: "#D97706" },
  { slug: "meditation", icon: Brain, accent: "#7C3AED" },
  { slug: "library", icon: BookOpen, accent: "#0D9488" },
];

export function getModule(slug: ModuleSlug): ModuleDefinition {
  const mod = modules.find((m) => m.slug === slug);
  if (!mod) throw new Error(`Unknown module: ${slug}`);
  return mod;
}
