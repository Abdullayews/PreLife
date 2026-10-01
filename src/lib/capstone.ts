import { BookOpen, Brain, Dumbbell, Salad, type LucideIcon } from "lucide-react";

/**
 * Capstone section system (welcome/home only — separate from app modules).
 * Taxonomy per capstone doc, mapped onto existing module routes:
 *   Psikoloji (psikoloqlar, videolar, meditasyon, AI)  -> /meditation
 *   Kitab     (kitablar, AI)                           -> /library
 *   Spor      (spor, GYM, yoga, plates, hocalar, ...)  -> /gym
 *   Diet      (diet, dietisyenler, videolar, AI)       -> /diet
 *
 * Palette (capstone color rules, light theme):
 *   Psikoloji  Dry Sage  (#7D8F6D)   [psikoloqlar: Dry Sage + Taupe]
 *   Kitab      Antique Brass (#8A6A45) [matched — capstone chip missing]
 *   Spor       Merlot (#7B2D3B) + Bone tint [GYM: Bone + Merlot]
 *   Diet       Pistachio (#5F7F52)   [matched — capstone gave no colors]
 * Abonelik is not a content card: it is referenced in the CTA band note.
 */
export type CapstoneId = "psikoloji" | "kitab" | "sport" | "diet";

export type CapstoneSection = {
  id: CapstoneId;
  href: string;
  icon: LucideIcon;
  accent: string;
  tint: string;
};

export const capstoneSections: CapstoneSection[] = [
  {
    id: "psikoloji",
    href: "/meditation",
    icon: Brain,
    accent: "#7D8F6D",
    tint: "#EEF1E7",
  },
  {
    id: "kitab",
    href: "/library",
    icon: BookOpen,
    accent: "#8A6A45",
    tint: "#F3ECE0",
  },
  {
    id: "sport",
    href: "/gym",
    icon: Dumbbell,
    accent: "#7B2D3B",
    tint: "#F1EDE3",
  },
  {
    id: "diet",
    href: "/diet",
    icon: Salad,
    accent: "#5F7F52",
    tint: "#EAF0E4",
  },
];

export function getCapstoneSections(): CapstoneSection[] {
  return capstoneSections;
}

export function getCapstoneSection(id: CapstoneId): CapstoneSection {
  const section = capstoneSections.find((s) => s.id === id);
  if (!section) throw new Error(`Unknown capstone section: ${id}`);
  return section;
}
