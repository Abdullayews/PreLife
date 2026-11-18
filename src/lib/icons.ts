import {
  Activity, AudioLines, Backpack, BicepsFlexed, BookOpen, Cable, CalendarDays,
  ChefHat, ClipboardList, Compass, Cookie, CupSoda, Dumbbell, FaceSlightlySmiling,
  Fish, Flame, Footprints, Grab, Hand, HeartPulse, Landmark, Layers, Leaf,
  Lightbulb, MapPin, Microscope, Milk, Moon, Move, NotebookPen, PersonStanding,
  Pill, Shield, Shirt, Soup, Sparkles, Sun, Target, Timer, Users2, Waves,
  Wheat, Wind, Zap, type LucideIcon,
} from "lucide-react";

/**
 * Icon registry — the DB stores Lucide icon NAMES (strings) on content rows
 * (world items, canDo cards, shop products); this map turns a name back into
 * the component on the client. Keep in sync with the names the seeder writes.
 */
export const ICONS: Record<string, LucideIcon> = {
  Activity, AudioLines, Backpack, BicepsFlexed, BookOpen, Cable, CalendarDays,
  ChefHat, ClipboardList, Compass, Cookie, CupSoda, Dumbbell, FaceSlightlySmiling,
  Fish, Flame, Footprints, Grab, Hand, HeartPulse, Landmark, Layers, Leaf,
  Lightbulb, MapPin, Microscope, Milk, Moon, Move, NotebookPen, PersonStanding,
  Pill, Shield, Shirt, Soup, Sparkles, Sun, Target, Timer, Users2, Waves,
  Wheat, Wind, Zap,
};

export const iconByName = (name: string): LucideIcon => ICONS[name] ?? Sparkles;
