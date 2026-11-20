import { getMessages } from "next-intl/server";
import { msgPath, type MessageTree } from "@/lib/gym";
import { supaSelectOne, supaUpdate, supaInsert } from "./supa";
import { gymCatalog } from "./content";
import { getAiPrompt, getAiSettings } from "./ai-config";
import { geminiGenerate, toGeminiContents } from "./ai-gemini";

/**
 * Personal workout plans (v3.3) — one ACTIVE plan per user in user_plans.
 *
 * The template plan catalog is retired from the user surface: a fresh
 * user gets the DEFAULT starter plan automatically; the questionnaire on
 * the plan tab (or a chat with the AI) replaces it with a personal,
 * AI-generated plan. Exercise entries carry a registry CODE when they map
 * to the İdman exercise pool (gym_exercises, so the plan tab can render
 * the demo video, target muscles and guide) plus the display strings the
 * model wrote.
 */

type Row = Record<string, unknown>;

export type PlanExercise = {
  ex: string;
  name: string;
  sets: number;
  reps: string;
  rest: number;
  note?: string;
};

export type PlanDay = {
  day: number; // 1 = Monday … 7 = Sunday
  focus: string;
  exercises: PlanExercise[];
};

export type UserPlan = {
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

export type PlanAnswers = {
  goal?: string;
  experience?: string;
  days?: string | number;
  equipment?: string;
  focus?: string;
  limitations?: string;
};

/* ── The exercise registry (code → display strings) ─────────────────────── */

export type ExerciseRegEntry = { code: string; name: string; target: string };
export type ExerciseRegistry = Map<string, ExerciseRegEntry>;

/** Minimal static fallback — code + a safe generic name — kept ONLY for
 *  when the content DB is unreachable, so the starter plan and the AI
 *  prompt still function. Everything else reads gym_exercises. */
export const EXERCISE_REGISTRY: readonly ExerciseRegEntry[] = [
  "run", "stretch", "squat", "deadlift", "bench", "pullup", "row", "ohp",
  "lunge", "plank", "swing", "legpress", "latpull", "bicep", "triceps",
].map((code) => ({ code, name: code, target: "" }));

const fallbackRegistry = (): ExerciseRegistry =>
  new Map(EXERCISE_REGISTRY.map((e) => [e.code, e]));

/**
 * The live registry: gym_exercises through the content layer (TTL-cached),
 * with name/target resolved to the requested locale at call time.
 */
export async function loadExerciseRegistry(locale: string): Promise<ExerciseRegistry> {
  try {
    const cat = await gymCatalog();
    const ex = cat?.exercises as
      | Record<string, { nameKey: string; targetKey: string }>
      | undefined;
    if (ex && Object.keys(ex).length > 0) {
      const all = (await getMessages({ locale })) as MessageTree;
      const app = (all.gymApp ?? {}) as MessageTree;
      const reg: ExerciseRegistry = new Map();
      for (const [code, ref] of Object.entries(ex)) {
        reg.set(code, {
          code,
          name: msgPath(app, ref.nameKey) ?? code,
          target: msgPath(app, ref.targetKey) ?? "",
        });
      }
      return reg;
    }
  } catch {
    /* content DB unreachable — the static fallback keeps plans working */
  }
  return fallbackRegistry();
}

export function registryBlock(reg: ExerciseRegistry): string {
  return [...reg.values()].map((e) => `${e.code} — ${e.name} (${e.target})`).join("; ");
}

/* ── Reading ────────────────────────────────────────────────────────────── */

function rowToPlan(row: Row): UserPlan | null {
  if (typeof row.id !== "string") return null;
  const days = Array.isArray(row.days) ? (row.days as PlanDay[]) : [];
  return {
    id: row.id,
    title: typeof row.title === "string" ? row.title : "Plan",
    level: typeof row.level === "string" ? row.level : null,
    source: row.source === "ai" ? "ai" : "default",
    week: typeof row.week === "number" ? row.week : 1,
    total: typeof row.total === "number" ? row.total : 8,
    focus: typeof row.focus === "string" ? row.focus : null,
    days,
    notes: typeof row.notes === "string" ? row.notes : null,
    createdAt: typeof row.created_at === "string" ? row.created_at : "",
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : "",
  };
}

export async function getActivePlan(userId: string): Promise<UserPlan | null> {
  try {
    const row = await supaSelectOne("user_plans", [
      ["select", "*"],
      ["user_id", `eq.${userId}`],
      ["active", "eq.true"],
      ["order", "created_at.desc"],
    ]);
    return row ? rowToPlan(row) : null;
  } catch {
    return null;
  }
}

/** One-line plan summary for the AI context prompt. */
export async function planSummaryLine(userId: string): Promise<string> {
  const plan = await getActivePlan(userId);
  if (!plan) return "none yet (the user still has the default starter plan or none)";
  return `"${plan.title}" (${plan.source === "ai" ? "AI-generated" : "starter"}), week ${plan.week}/${plan.total}, ${plan.days.length} training days/week`;
}

/* ── The default starter plan ───────────────────────────────────────────── */

const DEFAULT_COPY: Record<string, { title: string; focus: string; levels: string[] }> = {
  az: { title: "Başlanğıc plan", focus: "Bütün bədən gücü və vərdiş", levels: ["Başlanğıc", "Orta", "İleri"] },
  en: { title: "Starter plan", focus: "Full-body strength & habit", levels: ["Beginner", "Intermediate", "Advanced"] },
  ru: { title: "Стартовый план", focus: "Сила всего тела и привычка", levels: ["Начальный", "Средний", "Продвинутый"] },
};

function defaultPlan(locale: string, reg: ExerciseRegistry): Omit<UserPlan, "id" | "createdAt" | "updatedAt"> {
  const copy = DEFAULT_COPY[locale] ?? DEFAULT_COPY.az;
  const ex = (code: string, sets: number, reps: string, rest: number, note?: string): PlanExercise => {
    const r = reg.get(code);
    return { ex: code, name: r?.name ?? code, sets, reps, rest, note };
  };
  return {
    title: copy.title,
    level: copy.levels[0]!,
    source: "default",
    week: 1,
    total: 8,
    focus: copy.focus,
    days: [
      {
        day: 1,
        focus: locale === "ru" ? "Всё тело A" : locale === "en" ? "Full body A" : "Bütün bədən A",
        exercises: [
          ex("run", 1, "5–8 dəq", 0),
          ex("squat", 4, "8–10", 90),
          ex("bench", 4, "8–10", 90),
          ex("row", 4, "10–12", 75),
          ex("plank", 3, "30–45 s", 60),
        ],
      },
      {
        day: 3,
        focus: locale === "ru" ? "Всё тело B" : locale === "en" ? "Full body B" : "Bütün bədən B",
        exercises: [
          ex("run", 1, "5–8 dəq", 0),
          ex("deadlift", 4, "6–8", 120),
          ex("ohp", 4, "8–10", 90),
          ex("latpull", 4, "10–12", 75),
          ex("bicep", 3, "10–12", 60),
        ],
      },
      {
        day: 5,
        focus: locale === "ru" ? "Всё тело C" : locale === "en" ? "Full body C" : "Bütün bədən C",
        exercises: [
          ex("run", 1, "5–8 dəq", 0),
          ex("legpress", 4, "10–12", 90),
          ex("lunge", 3, "10 (hər ayaq)", 75),
          ex("triceps", 3, "10–12", 60),
          ex("stretch", 1, "5 dəq", 0),
        ],
      },
    ],
    notes: null,
  };
}

/* ── Validation / normalization (AI output and client input alike) ──────── */

const clamp = (v: number, lo: number, hi: number, dflt: number) =>
  Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : dflt;

function str(v: unknown, max: number, dflt = ""): string {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : dflt;
}

export function normalizePlanInput(
  raw: unknown,
  locale: string,
  reg: ExerciseRegistry,
): Omit<UserPlan, "id" | "createdAt" | "updatedAt"> | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const daysRaw = Array.isArray(r.days) ? r.days : [];
  if (daysRaw.length === 0) return null;

  const seenDays = new Set<number>();
  const days: PlanDay[] = [];
  for (const dRaw of daysRaw.slice(0, 7)) {
    if (!dRaw || typeof dRaw !== "object") continue;
    const d = dRaw as Record<string, unknown>;
    const day = clamp(Number(d.day), 1, 7, 1);
    if (seenDays.has(day)) continue;
    seenDays.add(day);
    const exRaw = Array.isArray(d.exercises) ? d.exercises : [];
    const exercises: PlanExercise[] = [];
    for (const eRaw of exRaw.slice(0, 10)) {
      if (!eRaw || typeof eRaw !== "object") continue;
      const e = eRaw as Record<string, unknown>;
      const code = typeof e.ex === "string" && reg.has(e.ex) ? e.ex : "";
      const regEx = code ? reg.get(code)! : null;
      const name = str(e.name, 60) || regEx?.name || (locale === "en" ? "Exercise" : locale === "ru" ? "Упражнение" : "Hərəkət");
      exercises.push({
        ex: code,
        name,
        sets: clamp(Number(e.sets), 1, 8, 3),
        reps: str(e.reps, 24, "10"),
        rest: clamp(Number(e.rest), 0, 300, 90),
        note: str(e.note, 160) || undefined,
      });
    }
    if (exercises.length === 0) continue;
    days.push({ day, focus: str(d.focus, 60, locale === "en" ? "Training" : locale === "ru" ? "Тренировка" : "Təlim"), exercises });
  }
  if (days.length === 0) return null;
  days.sort((a, b) => a.day - b.day);

  return {
    title: str(r.title, 80) || defaultPlan(locale, reg).title,
    level: str(r.level, 20) || null,
    source: r.source === "default" ? "default" : "ai",
    week: 1,
    total: clamp(Number(r.totalWeeks ?? r.total), 4, 16, 8),
    focus: str(r.focus, 120) || null,
    days,
    notes: str(r.notes, 400) || null,
  };
}

/* ── Writing ────────────────────────────────────────────────────────────── */

async function insertActive(userId: string, plan: Omit<UserPlan, "id" | "createdAt" | "updatedAt">): Promise<UserPlan | null> {
  await supaUpdate("user_plans", [
    ["user_id", `eq.${userId}`],
    ["active", "eq.true"],
  ], { active: false }).catch(() => {});
  const row = await supaInsert("user_plans", {
    user_id: userId,
    title: plan.title,
    level: plan.level,
    source: plan.source,
    week: plan.week,
    total: plan.total,
    focus: plan.focus,
    days: plan.days,
    notes: plan.notes,
    active: true,
  });
  return row ? rowToPlan(row) : null;
}

/** The signed-in user's plan — the default starter plan is created lazily
 *  on the very first read (so the plan tab is never empty). */
export async function ensureDefaultPlan(userId: string, locale: string): Promise<UserPlan | null> {
  const existing = await getActivePlan(userId);
  if (existing) return existing;
  try {
    const reg = await loadExerciseRegistry(locale);
    return await insertActive(userId, { ...defaultPlan(locale, reg), source: "default" });
  } catch (e) {
    console.error("[plans] default plan insert failed:", e);
    return null;
  }
}

/** Deactivate everything (the next read re-creates the starter plan). */
export async function resetPlans(userId: string): Promise<void> {
  await supaUpdate("user_plans", [["user_id", `eq.${userId}`]], { active: false }).catch(() => {});
}

/* ── AI generation ──────────────────────────────────────────────────────── */

const LANG_NAME: Record<string, string> = { az: "Azerbaijani", en: "English", ru: "Russian" };

export async function generatePlan(
  userId: string,
  answers: PlanAnswers,
  locale: string,
): Promise<{ plan: UserPlan | null; source: "ai" | "rules" }> {
  const lang = LANG_NAME[locale] ?? "Azerbaijani";
  const [settings, reg] = await Promise.all([
    getAiSettings(),
    loadExerciseRegistry(locale),
  ]);

  if (settings) {
    try {
      const system = await getAiPrompt("plan");
      const user = [
        `Questionnaire answers (JSON): ${JSON.stringify(answers)}`,
        `Answer language: ${lang} — every user-facing string must be in ${lang}.`,
        `EXERCISE REGISTRY (code — name — target): ${registryBlock(reg)}.`,
      ].join("\n");
      const out = await geminiGenerate({
        apiKey: settings.apiKey,
        model: settings.model,
        system,
        contents: toGeminiContents([{ role: "user", content: user }]),
        jsonMode: true,
        maxOutputTokens: 3072,
      });
      const cleaned = out.text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
      const parsed = JSON.parse(cleaned) as unknown;
      const plan = normalizePlanInput({ ...(parsed as Row), source: "ai" }, locale, reg);
      if (plan) {
        const saved = await insertActive(userId, plan);
        if (saved) return { plan: saved, source: "ai" };
      }
    } catch (e) {
      console.error("[plans] AI generation failed → rule-based fallback:", e instanceof Error ? e.message : e);
    }
  }

  const fallback = ruleBasedPlan(answers, locale, reg);
  const saved = await insertActive(userId, fallback);
  return { plan: saved, source: "rules" };
}

/** Deterministic fallback so the questionnaire ALWAYS produces a plan,
 *  even when the AI provider is unreachable. */
function ruleBasedPlan(
  answers: PlanAnswers,
  locale: string,
  reg: ExerciseRegistry,
): Omit<UserPlan, "id" | "createdAt" | "updatedAt"> {
  const base = defaultPlan(locale, reg);
  const exName = (code: string): string => reg.get(code)?.name ?? code;
  const daysWanted = clamp(Number(answers.days), 2, 6, 3);
  const experience = (answers.experience ?? "").toLowerCase();
  const goal = (answers.goal ?? "").toLowerCase();

  const level = experience.includes("adv") || experience.includes("ileri") || experience.includes("продолж")
    ? (locale === "en" ? "Advanced" : locale === "ru" ? "Продвинутый" : "İleri")
    : experience.includes("int") || experience.includes("orta") || experience.includes("средн")
      ? (locale === "en" ? "Intermediate" : locale === "ru" ? "Средний" : "Orta")
      : (locale === "en" ? "Beginner" : locale === "ru" ? "Начальный" : "Başlanğıc");
  const strengthBias = goal.includes("muscle") || goal.includes("güc") || goal.includes("mass") || goal.includes("kütlə") || goal.includes("мышц") || goal.includes("масс");

  const extra: PlanDay[] = [];
  if (daysWanted >= 4) {
    extra.push({
      day: 2,
      focus: locale === "ru" ? "Верх тела" : locale === "en" ? "Upper body" : "Bədənin üstü",
      exercises: [
        { ex: "pullup", name: exName("pullup"), sets: 4, reps: "6–10", rest: 90 },
        { ex: "ohp", name: exName("ohp"), sets: 4, reps: "8–10", rest: 90 },
        { ex: "latpull", name: exName("latpull"), sets: 3, reps: "10–12", rest: 75 },
        { ex: "triceps", name: exName("triceps"), sets: 3, reps: "10–12", rest: 60 },
      ],
    });
  }
  if (daysWanted >= 5) {
    extra.push({
      day: 4,
      focus: locale === "ru" ? "Низ тела" : locale === "en" ? "Lower body" : "Bədənin altı",
      exercises: [
        { ex: "deadlift", name: exName("deadlift"), sets: 4, reps: "6–8", rest: 120 },
        { ex: "legpress", name: exName("legpress"), sets: 4, reps: "10–12", rest: 90 },
        { ex: "lunge", name: exName("lunge"), sets: 3, reps: "10 (hər ayaq)", rest: 75 },
        { ex: "plank", name: exName("plank"), sets: 3, reps: "40 s", rest: 60 },
      ],
    });
  }

  const focusLine = [
    answers.focus, strengthBias ? (locale === "en" ? "strength focus" : locale === "ru" ? "силовой фокус" : "güc fokuslu") : null,
  ].filter(Boolean).join(" · ");

  return {
    ...base,
    title: locale === "ru" ? "Личный план" : locale === "en" ? "Personal plan" : "Şəxsi plan",
    level,
    source: "ai",
    focus: focusLine || base.focus,
    days: [...base.days, ...extra].sort((a, b) => a.day - b.day)
      .slice(0, Math.min(5, Math.max(3, daysWanted))),
  };
}

/** Normalize a plan that arrived through the AI CHAT tool (the same shape
 *  the /api/gym/plan POST accepts). */
export async function saveChatPlan(
  userId: string,
  raw: unknown,
  locale: string,
): Promise<UserPlan | null> {
  const reg = await loadExerciseRegistry(locale);
  const plan = normalizePlanInput({ ...(raw as Row), source: "ai" }, locale, reg);
  if (!plan) return null;
  return insertActive(userId, plan);
}
