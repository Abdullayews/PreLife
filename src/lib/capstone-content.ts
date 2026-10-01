import {
  Activity,
  Bot,
  BookOpen,
  CirclePlay,
  Dumbbell,
  Flower2,
  PersonStanding,
  UtensilsCrossed,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { CapstoneId } from "@/lib/capstone";

/**
 * Capstone doc sub-sections per section:
 *   Psikoloji: psikoloqlar, videolar, meditasyon, AI
 *   Kitab:     kitablar, AI
 *   Spor:      GYM, yoga, plates, spor hocalari, videolar, AI
 *   Diet:      diet, dietisyenler, videolar, AI
 */
export type SubSectionDef = {
  id: string;
  icon: LucideIcon;
};

export const subSections: Record<CapstoneId, SubSectionDef[]> = {
  psikoloji: [
    { id: "psikoloqlar", icon: Users },
    { id: "videolar", icon: CirclePlay },
    { id: "meditasyon", icon: Flower2 },
    { id: "ai", icon: Bot },
  ],
  kitab: [
    { id: "kitablar", icon: BookOpen },
    { id: "ai", icon: Bot },
  ],
  sport: [
    { id: "gym", icon: Dumbbell },
    { id: "yoga", icon: PersonStanding },
    { id: "plates", icon: Activity },
    { id: "hocalar", icon: Users },
    { id: "videolar", icon: CirclePlay },
    { id: "ai", icon: Bot },
  ],
  diet: [
    { id: "diet", icon: UtensilsCrossed },
    { id: "dietisyenler", icon: Users },
    { id: "videolar", icon: CirclePlay },
    { id: "ai", icon: Bot },
  ],
};

export function getSubSections(id: CapstoneId): SubSectionDef[] {
  return subSections[id];
}

/** Sample content cards per section. `sub` ties each item to a sub-section chip. */
export type SampleItem = {
  sub: string;
};

export const sampleItems: Record<CapstoneId, SampleItem[]> = {
  psikoloji: [
    { sub: "meditasyon" },
    { sub: "psikoloqlar" },
    { sub: "videolar" },
    { sub: "ai" },
  ],
  kitab: [{ sub: "kitablar" }, { sub: "kitablar" }, { sub: "kitablar" }, { sub: "ai" }],
  sport: [
    { sub: "gym" },
    { sub: "yoga" },
    { sub: "plates" },
    { sub: "hocalar" },
  ],
  diet: [
    { sub: "diet" },
    { sub: "diet" },
    { sub: "dietisyenler" },
    { sub: "videolar" },
  ],
};

export function getSampleItems(id: CapstoneId): SampleItem[] {
  return sampleItems[id];
}
