import type { LucideIcon } from "lucide-react";

export type Level = "beginner" | "intermediate" | "advanced";

export type GymPlan = {
  id: string;
  nameKey: string;
  descKey: string;
  image: string;
  imageAltKey: string;
  level: Level;
  weeks: number;
  daysPerWeek: number;
  kcal: number;
};

export type GymExercise = {
  id: string;
  nameKey: string;
  targetKey: string;
  icon: LucideIcon;
  level: Level;
};

export type GymVenue = {
  id: string;
  nameKey: string;
  descKey: string;
  image: string;
  imageAltKey: string;
  rating: number;
  featureKeys: string[];
};
