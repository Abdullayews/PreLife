import { BookOpen, Brain, Dumbbell, Salad, type LucideIcon } from "lucide-react";

/**
 * Capstone section system (welcome/home only — separate from app modules).
 * Taxonomy per capstone doc, mapped onto existing module routes:
 *   Psikoloji (psikoloqlar, videolar, meditasyon, AI)  -> /meditation
 *   Kitab     (kitablar, AI)                           -> /library
 *   Spor      (spor, GYM, yoga, plates, hocalar, ...)  -> /gym
 *   Diet      (diet, dietisyenler, videolar, AI)       -> /diet
 *
 * Display order (per product decision): Gym, Diet, Psychology, Books —
 * sport first, then diet, then psikoloji, then kitab. Every surface that
 * lists the four sections (site nav row, hero chips, welcome/home cards)
 * renders this array in order.
 *
 * Palette (capstone color rules, light theme):
 *   Psikoloji  Dry Sage  (#7D8F6D)   [psikoloqlar: Dry Sage + Taupe]
 *   Kitab      Antique Brass (#8A6A45) [matched — capstone chip missing]
 *   Spor       Merlot (#7B2D3B) + Bone tint [GYM: Bone + Merlot]
 *   Diet       Pistachio (#5F7F52)   [matched — capstone gave no colors]
 * Tints are the accent at 10% alpha (same convention as the module
 * "explore" chips), NOT opaque light hexes — an opaque bone chip glows
 * like a sticker in dark mode, while accent+alpha re-balances on both
 * the light and the espresso surfaces.
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
    id: "sport",
    href: "/gym",
    icon: Dumbbell,
    accent: "#7B2D3B",
    tint: "#7B2D3B1A",
  },
  {
    id: "diet",
    href: "/diet",
    icon: Salad,
    accent: "#5F7F52",
    tint: "#5F7F521A",
  },
  {
    id: "psikoloji",
    href: "/meditation",
    icon: Brain,
    accent: "#7D8F6D",
    tint: "#7D8F6D1A",
  },
  {
    id: "kitab",
    href: "/library",
    icon: BookOpen,
    accent: "#8A6A45",
    tint: "#8A6A451A",
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
