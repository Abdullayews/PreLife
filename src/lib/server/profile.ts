import { supaSelect, supaSelectOne, supaUpdate, supaInsert } from "./supa";
import { ApiCode } from "./psych-data";

/**
 * The user's own data — the profiles row (name, avatar, body metrics,
 * goal, activity) plus the weight history in user_weight_logs. Shared by
 * the /api/me/profile route, the AI account tools and the profile page.
 *
 * v3.3 columns: gender, birth_year, height_cm, goal, activity_level,
 * plan_onboarding_done, rail_folded (joining the v3 fitness_level /
 * workouts_per_week / avatar_url and the v3.2 lang / theme).
 */

type Row = Record<string, unknown>;

export const GENDERS = ["male", "female", "other"] as const;
export const GOALS = ["lose", "maintain", "gain", "fitness"] as const;
export const ACTIVITY_LEVELS = ["sedentary", "light", "moderate", "active", "athlete"] as const;
export const FITNESS_LEVELS = ["beginner", "intermediate", "advanced"] as const;

export type ProfileView = {
  name: string | null;
  avatarUrl: string | null;
  lang: string;
  theme: string;
  railFolded: boolean;
  gender: string | null;
  birthYear: number | null;
  heightCm: number | null;
  goal: string | null;
  activityLevel: string | null;
  fitnessLevel: string | null;
  workoutsPerWeek: number | null;
  planOnboardingDone: boolean;
  weightKg: number | null;
  weightUpdatedAt: string | null;
  updatedAt: string | null;
};

function str(v: unknown): string | null {
  return typeof v === "string" && v ? v : null;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

async function latestWeight(userId: string): Promise<{ kg: number | null; at: string | null }> {
  try {
    const row = await supaSelectOne("user_weight_logs", [
      ["select", "weight_kg,log_date,created_at"],
      ["user_id", `eq.${userId}`],
      ["order", "log_date.desc"],
    ]);
    if (!row) return { kg: null, at: null };
    return {
      kg: num(row.weight_kg),
      at: str(row.log_date) ?? str(row.created_at),
    };
  } catch {
    return { kg: null, at: null };
  }
}

export async function getProfileView(userId: string): Promise<ProfileView> {
  const row = (await supaSelectOne("profiles", [
    ["select", "*"],
    ["id", `eq.${userId}`],
  ])) ?? {};
  const weight = await latestWeight(userId);
  return {
    name: str(row.full_name),
    avatarUrl: str(row.avatar_url),
    lang: str(row.lang) ?? "en",
    theme: str(row.theme) ?? "light",
    railFolded: row.rail_folded === true,
    gender: str(row.gender),
    birthYear: num(row.birth_year),
    heightCm: num(row.height_cm),
    goal: str(row.goal),
    activityLevel: str(row.activity_level),
    fitnessLevel: str(row.fitness_level),
    workoutsPerWeek: num(row.workouts_per_week),
    planOnboardingDone: row.plan_onboarding_done === true,
    weightKg: weight.kg,
    weightUpdatedAt: weight.at,
    updatedAt: str(row.updated_at),
  };
}

/** A compact one-line profile summary for the AI context prompt. */
export async function profileSummaryLine(userId: string): Promise<string> {
  try {
    const p = await getProfileView(userId);
    const parts: string[] = [];
    if (p.weightKg !== null) parts.push(`${p.weightKg} kg`);
    if (p.heightCm !== null) parts.push(`${p.heightCm} cm`);
    if (p.goal) parts.push(`goal: ${p.goal}`);
    if (p.activityLevel) parts.push(`activity: ${p.activityLevel}`);
    if (p.fitnessLevel) parts.push(`level: ${p.fitnessLevel}`);
    if (p.workoutsPerWeek !== null) parts.push(`${p.workoutsPerWeek}×/week`);
    return parts.length ? parts.join(", ") : "not filled in yet";
  } catch {
    return "unavailable";
  }
}

/* ── validation ─────────────────────────────────────────────────────────── */

const AVATAR_RE = /^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/;
const AVATAR_MAX_CHARS = 500_000; // ≈ 375 KB — resized client-side to ~256px

function oneOf<T extends readonly string[]>(list: T, v: unknown): T[number] | null {
  return typeof v === "string" && (list as readonly string[]).includes(v)
    ? (v as T[number]) : null;
}

export type ProfilePatchIn = {
  name?: unknown;
  avatarUrl?: unknown;
  gender?: unknown;
  birthYear?: unknown;
  heightCm?: unknown;
  weightKg?: unknown;
  goal?: unknown;
  activityLevel?: unknown;
  fitnessLevel?: unknown;
  workoutsPerWeek?: unknown;
  railFolded?: unknown;
  planOnboardingDone?: unknown;
};

/** Validate + apply a partial profile update. Throws ApiCode on bad input.
 *  Name / avatar changes are mirrored onto the user's session rows so the
 *  rail re-renders correctly on the next server render. */
export async function updateProfile(userId: string, body: ProfilePatchIn): Promise<ProfileView> {
  const patch: Row = {};
  const errors: string[] = [];

  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || [...name].length > 100) errors.push("name");
    else patch.full_name = name;
  }
  if (body.avatarUrl !== undefined) {
    if (body.avatarUrl === null || body.avatarUrl === "") patch.avatar_url = null;
    else if (typeof body.avatarUrl === "string" && AVATAR_RE.test(body.avatarUrl)
      && body.avatarUrl.length <= AVATAR_MAX_CHARS) patch.avatar_url = body.avatarUrl;
    else errors.push("avatarUrl");
  }
  if (body.gender !== undefined) {
    const v = oneOf(GENDERS, body.gender);
    if (!v) errors.push("gender");
    else patch.gender = v;
  }
  if (body.birthYear !== undefined) {
    const v = Number(body.birthYear);
    if (!Number.isInteger(v) || v < 1900 || v > new Date().getFullYear()) errors.push("birthYear");
    else patch.birth_year = v;
  }
  if (body.heightCm !== undefined) {
    const v = Number(body.heightCm);
    if (!Number.isFinite(v) || v < 80 || v > 260) errors.push("heightCm");
    else patch.height_cm = Math.round(v);
  }
  if (body.goal !== undefined) {
    const v = oneOf(GOALS, body.goal);
    if (!v) errors.push("goal");
    else patch.goal = v;
  }
  if (body.activityLevel !== undefined) {
    const v = oneOf(ACTIVITY_LEVELS, body.activityLevel);
    if (!v) errors.push("activityLevel");
    else patch.activity_level = v;
  }
  if (body.fitnessLevel !== undefined) {
    const v = oneOf(FITNESS_LEVELS, body.fitnessLevel);
    if (!v) errors.push("fitnessLevel");
    else patch.fitness_level = v;
  }
  if (body.workoutsPerWeek !== undefined) {
    const v = Number(body.workoutsPerWeek);
    if (!Number.isInteger(v) || v < 0 || v > 14) errors.push("workoutsPerWeek");
    else patch.workouts_per_week = v;
  }
  if (body.railFolded !== undefined) {
    if (typeof body.railFolded !== "boolean") errors.push("railFolded");
    else patch.rail_folded = body.railFolded;
  }
  if (body.planOnboardingDone !== undefined) {
    if (typeof body.planOnboardingDone !== "boolean") errors.push("planOnboardingDone");
    else patch.plan_onboarding_done = body.planOnboardingDone;
  }

  if (errors.length) throw new ApiCode(400, errors[0]!);

  // Weight goes to the log table (one row per day — upsert today's entry)
  // BEFORE the nothing-to-update check: a weight-only PATCH is valid.
  if (body.weightKg !== undefined) {
    const v = Number(body.weightKg);
    if (!Number.isFinite(v) || v < 20 || v > 400) throw new ApiCode(400, "weightKg");
    const today = new Date().toISOString().slice(0, 10);
    const existing = await supaSelectOne("user_weight_logs", [
      ["select", "id"],
      ["user_id", `eq.${userId}`],
      ["log_date", `eq.${today}`],
    ]);
    if (existing && typeof existing.id === "string") {
      await supaUpdate("user_weight_logs", [["id", `eq.${existing.id}`]], { weight_kg: v });
    } else {
      await supaInsert("user_weight_logs", { user_id: userId, log_date: today, weight_kg: v });
    }
  }

  if (Object.keys(patch).length === 0) {
    // Weight-only patches have already done their work above.
    if (body.weightKg !== undefined) return getProfileView(userId);
    throw new ApiCode(400, "nothing_to_update");
  }

  await supaUpdate("profiles", [["id", `eq.${userId}`]], patch);

  // Mirror identity changes onto the session rows (the rail reads them).
  const sessionPatch: Row = {};
  if (typeof patch.full_name === "string") sessionPatch.user_name = patch.full_name;
  if ("avatar_url" in patch) sessionPatch.user_avatar = patch.avatar_url ?? null;
  if (typeof patch.rail_folded === "boolean") sessionPatch.user_folded = patch.rail_folded;
  if (Object.keys(sessionPatch).length) {
    await supaUpdate("sessions", [["user_id", `eq.${userId}`]], sessionPatch).catch(() => {});
  }

  return getProfileView(userId);
}

/** The user's weight history (newest first) for the profile page chart. */
export async function weightHistory(userId: string, limit = 30): Promise<
  { logDate: string; weightKg: number }[]
> {
  try {
    const rows = (await supaSelect("user_weight_logs", [
      ["select", "log_date,weight_kg"],
      ["user_id", `eq.${userId}`],
      ["order", "log_date.desc"],
      ["limit", String(limit)],
    ])) as Row[];
    return rows
      .filter((r) => typeof r.log_date === "string" && typeof r.weight_kg === "number")
      .map((r) => ({ logDate: r.log_date as string, weightKg: r.weight_kg as number }));
  } catch {
    return [];
  }
}
