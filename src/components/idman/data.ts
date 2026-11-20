import type { GymAppExercise } from "@/lib/gym";

/**
 * İdman v4 — the presentation shell of the gym surface.
 *
 * ALL business data (halls, trainers, equipment, stores, products, the
 * exercise pool, plan catalog) arrives from the server as resolved,
 * locale-final props (lib/api.ts → getGymAppContent → IdmanApp) and every
 * user-facing string renders through the gymApp message namespace. What
 * remains here is presentation structure only:
 *
 *  • the tab id registry (labels/icons live in gymApp + AppShell),
 *  • the Mixkit stock-video registry (a presentation asset — hotlinked
 *    free clips, keyed by exercise code / product slug),
 *  • the questionnaire STRUCTURE (step order, pick caps; the question and
 *    option text renders from gymApp.quiz.*),
 *  • the shop filter-group codes per product slug (labels from
 *    gymApp.group.*),
 *  • pure helpers over the plan payload.
 */

/* ── Tabs ────────────────────────────────────────────────────────────────── */

export type IdmanTabId =
  | "plan" | "supplements" | "accessories" | "gyms" | "equipment";

/** Rail/tab order — labels come from gymApp.tab_<id>. */
export const IDMAN_TABS: readonly { id: IdmanTabId }[] = [
  { id: "plan" },
  { id: "supplements" },
  { id: "accessories" },
  { id: "gyms" },
  { id: "equipment" },
] as const;

export const isIdmanTabId = (v: string): v is IdmanTabId =>
  IDMAN_TABS.some((t) => t.id === v);

/* ── Real stock videos (Mixkit, 720p, verified 200) ──────────────────────── */

const V = (id: number) => `https://assets.mixkit.co/videos/${id}/${id}-720.mp4`;

/** The clip pool — one real gym clip per concept. */
export const VIDEOS = {
  barbell: V(52094),      // barbell reps on a bench
  dumbbellRack: V(47484), // the dumbbell rack itself
  kettlebell: V(52088),   // dynamic power training
  bands: V(52118),        // arm-circle warm-up
  pullupBars: V(23450),   // training on the bars
  mat: V(52110),          // floor work in workout attire
  bench: V(52316),        // training-session footage
  rack: V(52091),         // strength training at the rack
  plates: V(52082),       // squats with weights
  roller: V(50972),       // recovery breathing
  squat: V(52106),        // squats
  lunge: V(52112),        // lunges
  deadlift: V(52089),     // heavy pulling
  row: V(52079),          // gym training
  ohp: V(52091),          // overhead strength
  latpull: V(52316),      // machine session
  bicep: V(40788),        // dumbbell curls
  triceps: V(52317),      // rope work
  swing: V(52088),        // explosive swings
  legpress: V(52082),     // leg drive
  plank: V(52110),        // core hold
  run: V(52104),          // warm-up
  stretch: V(50972),      // stretch & breathe
} as const;

/** Registry exercise code → its demo clip. */
export const exerciseVideo = (code: string): string | null =>
  (VIDEOS as Record<string, string>)[code] ?? null;

/** Shop product slug → its demo clip (the equipment tab previews). */
const PRODUCT_VIDEOS: Record<string, string> = {
  barbell: VIDEOS.barbell,
  dumbbells: VIDEOS.dumbbellRack,
  kettlebell: VIDEOS.kettlebell,
  bands: VIDEOS.bands,
  pullup: VIDEOS.pullupBars,
  mat: VIDEOS.mat,
  bench: VIDEOS.bench,
  rack: VIDEOS.rack,
  plates: VIDEOS.plates,
  roller: VIDEOS.roller,
  rope: V(23056), // skipping-rope footwork
};

export const productVideo = (slug: string): string | null =>
  PRODUCT_VIDEOS[slug] ?? null;

/* ── The active plan (the /api/gym/plan payload) ────────────────────────── */

export type PlanExercise = {
  /** Registry code into the exercise pool — "" when the AI wrote a custom move. */
  ex: string;
  name: string;
  sets: number;
  /** Free-form prescription, e.g. "8–10" or "40 saniyə" (server-localized). */
  reps: string;
  rest: number;
  note?: string;
};

export type PlanDay = {
  /** 1 = Monday … 7 = Sunday. */
  day: number;
  focus: string;
  exercises: PlanExercise[];
};

export type ActivePlan = {
  id: string;
  title: string;
  level: string | null;
  source: "default" | "ai";
  week: number;
  total: number;
  focus: string | null;
  days: PlanDay[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Muscle-group chips: registry targets + the names of custom AI moves. */
export const muscleGroupsOf = (
  day: PlanDay,
  registry: Record<string, GymAppExercise>,
): string[] => {
  const set = new Set<string>();
  for (const pe of day.exercises) {
    const ex = registry[pe.ex];
    if (!ex) { set.add(pe.name); continue; } // custom move — name only
    for (const part of ex.target.split(/[,·]/)) {
      const p = part.trim();
      if (p) set.add(p);
    }
  }
  return [...set].slice(0, 6);
};

/** Total working sets of a day. */
export const totalSetsOf = (day: PlanDay): number =>
  day.exercises.reduce((n, pe) => n + pe.sets, 0);

/** Rough session length: ~1.5 min of work per set + the rests between. */
export const minutesOf = (day: PlanDay): number => {
  let mins = 0;
  for (const pe of day.exercises) mins += pe.sets * 1.5 + (pe.rest * pe.sets) / 60;
  return Math.max(10, Math.round(mins));
};

/* ── The personal-plan questionnaire (structure only) ───────────────────── */

export type QuizAnswers = {
  goal: string;
  experience: string;
  days: string;
  equipment: string;
  focus: string;
  limitations: string;
};

export type QuizStepKind = "single" | "multi" | "free";

export type QuizStep = {
  /** gymApp.quiz.q_<id> holds the question; q_<id>_o<n> the options. */
  id: "goal" | "exp" | "days" | "place" | "focus" | "limits";
  kind: QuizStepKind;
  /** Option count (0 for the free-text step). */
  options: number;
  /** Multi-select pick cap. */
  cap?: number;
};

export const QUIZ_STEPS: readonly QuizStep[] = [
  { id: "goal", kind: "single", options: 4 },
  { id: "exp", kind: "single", options: 3 },
  { id: "days", kind: "single", options: 4 },
  { id: "place", kind: "single", options: 3 },
  { id: "focus", kind: "multi", options: 6, cap: 2 },
  { id: "limits", kind: "free", options: 0 },
];

/* ── Shop filter groups (codes; labels from gymApp.group.*) ─────────────── */

export type ShopGroupId = "weights" | "rigs" | "soft" | "protein" | "amino" | "vitamins";

/** Product slug → filter-group code (presentation grouping). */
export const SHOP_GROUPS: Record<string, ShopGroupId> = {
  /* equipment */
  barbell: "weights", dumbbells: "weights", kettlebell: "weights", plates: "weights",
  pullup: "rigs", bench: "rigs", rack: "rigs",
  bands: "soft", mat: "soft", roller: "soft",
  /* supplements */
  whey: "protein", proteinbar: "protein",
  creatine: "amino", bcaa: "amino", preworkout: "amino",
  omega3: "vitamins", vitamind: "vitamins", magnesium: "vitamins",
  multivit: "vitamins", electrolyte: "vitamins",
};

/** Chip order per shop tab ("accessories" groups by category label). */
export const GROUP_ORDER: Record<"supplements" | "equipment", ShopGroupId[]> = {
  supplements: ["protein", "amino", "vitamins"],
  equipment: ["weights", "rigs", "soft"],
};

/** The group code of a product — accessories/clothing group by category. */
export const groupOf = (p: { id: string; cat: string }): ShopGroupId | "cat" =>
  p.cat === "accessories" || p.cat === "clothing" ? "cat" : (SHOP_GROUPS[p.id] ?? "other");
