import ZAI from "z-ai-web-dev-sdk";
import { getAiPrompt, getAiSettings } from "./ai-config";
import { geminiGenerate, toGeminiContents, type GeminiContent, type GeminiFunctionDecl } from "./ai-gemini";
import { getProfileView, profileSummaryLine, updateProfile, type ProfilePatchIn } from "./profile";
import { getActivePlan, planSummaryLine, saveChatPlan } from "./user-plans";
import { createCustomPackage, listCustomPackages, packageSummaryLine } from "./packages";

/**
 * AI chat — the provider chain (v3.3):
 *
 *   1. GEMINI (ai_settings: key + gemini-flash-lite-latest) — the primary
 *      provider. For signed-in users the assistant carries FUNCTION TOOLS
 *      that actually change the account (profile data, workout plan,
 *      custom package), looping until the model answers with text.
 *   2. z-ai-web-dev-sdk — the fallback when Gemini is unreachable (the
 *      sandbox egress region is not supported by Google; production on
 *      Render calls Gemini directly). Plain chat, no tools.
 *   3. Canned replies per locale — the last resort, same as before.
 *
 * System prompts come from the ai_prompts table (editable in the DB) with
 * the constants in ai-prompts.ts as code fallback.
 */

export const SYSTEM_CHAT = ""; // kept for import compatibility — see PROMPT_ASSISTANT
export const SYSTEM_PSY = ""; // kept for import compatibility — see PROMPT_PSYCH

export const FALLBACK_CHAT: Record<string, string[]> = {
  az: [
    "Sualını dinlədim. PreLife dörd dünyanı birləşdirir: idman, qidalanma, psixologiya və kitab. İstədiyin bölməni seç — orada nələr edə biləcəyini addım-addım göstərərəm.",
    "Yaxşı sualdır. Qısa cavab: idman planı üçün İdman bölməsi, sağlam qidalanma üçün Qidalanma, sakitlik üçün Psixologiya, böyümək üçün Kitablar bölməsi var. Hansından başlamaq istəyirsən?",
    "Bir neçə yol var: bugünkü təlimə başlamaq, yeni resept tapmaq, əhvalını qeyd etmək və ya bir psixoloqla görüş ayırmaq. Özünə yaxın hiss edəni seç — qalanını birlikdə gəzərik.",
  ],
  en: [
    "I hear you. PreLife brings four worlds together: fitness, nutrition, psychology and reading. Pick the one you care about and I'll walk you through what you can do there.",
    "Good question. In short: the Gym section for training plans, Nutrition for meal plans and recipes, Psychology for calm and support, Books for growth. Where would you like to start?",
    "There are a few paths: start today's workout, find a new recipe, log how you feel, or book a psychologist. Choose what feels closest — we'll explore the rest together.",
  ],
  ru: [
    "Я вас услышал. PreLife объединяет четыре мира: фитнес, питание, психологию и чтение. Выберите близкий — и я расскажу, что там можно делать.",
    "Хороший вопрос. Коротко: раздел «Спорт» — планы тренировок, «Питание» — планы и рецепты, «Психология» — спокойствие и поддержка, «Книги» — рост. С чего начнём?",
    "Путей несколько: начать сегодняшнюю тренировку, найти рецепт, отметить настроение или записаться к психологу. Выберите близкое — остальное изучим вместе.",
  ],
};

export const FALLBACK_PSY: Record<string, string[]> = {
  az: [
    "Səni dinlədim. Əvvəlcə bir dəqiqə nəfəsini almağa çalış: 4 saniyə nəfəs al, 7 saxla, 8 saniyə burax. Bu dövrəni dörd dəfə təkrarlasan, gərginlik hissəli şəkildə düşür.",
    "Bəzən ən sakit addım ən balacadır — bugün üçün bir kiçik məqsəd seç: bir stəkan su, qısa gəzinti və ya bir səhifə kitab. Bu kiçik hərəkət zehni yerə qaytarır.",
    "Bu hissəni yazmaq çox dəyərlidir. Jurnal bölməsindəki promptlardan birini aç və fikirlərini boş sahəyə tök — yazmaq emosiyanı nizamlamağa kömək edir.",
  ],
  en: [
    "I hear you. Start with one minute of breathing: inhale 4 seconds, hold 7, exhale 8. Four rounds usually settle the tension noticeably.",
    "Sometimes the calmest step is the smallest — pick one tiny goal for today: a glass of water, a short walk, or one page of a book. Small motion returns the mind to the ground.",
    "Writing this down is valuable. Open one of the journal prompts and pour your thoughts into it — writing helps regulate emotion.",
  ],
  ru: [
    "Я вас услышал. Начните с одной минуты дыхания: вдох 4 секунды, задержка 7, выдох 8. Четыре цикла обычно заметно снижают напряжение.",
    "Иногда самый спокойный шаг — самый маленький: выберите одну маленькую цель на сегодня — стакан воды, короткую прогулку или страницу книги. Маленькое движение возвращает мыслям опору.",
    "Записать это — уже ценно. Откройте один из подсказок дневника и вылейте мысли на страницу — письмо помогает упорядочить эмоции.",
  ],
};

/* ── Shared request shape ────────────────────────────────────────────────── */

export type Msg = { role: "user" | "assistant"; content: string };

export type ParsedChatRequest = { locale: string; history: Msg[] };

export function parseChatBody(body: Record<string, unknown>): ParsedChatRequest {
  const rawLocale = body.locale;
  const locale = rawLocale === "az" ? "az" : rawLocale === "ru" ? "ru" : "en";

  const history: Msg[] = [];
  if (Array.isArray(body.messages)) {
    for (const m of body.messages) {
      if (!m || typeof m !== "object") continue;
      const role = (m as Row2).role;
      const content = (m as Row2).content;
      if ((role === "user" || role === "assistant") && typeof content === "string" && content) {
        history.push({ role, content: [...content].slice(0, 1200).join("") });
      }
    }
  }
  const trimmed = history.slice(-8);
  if (trimmed.length === 0 || trimmed[trimmed.length - 1]!.role !== "user") {
    throw new Error("invalid");
  }
  return { locale, history: trimmed };
}

type Row2 = { role?: unknown; content?: unknown };

function pickFallback(bank: Record<string, string[]>, locale: string): string {
  const arr = bank[locale] ?? bank.en;
  return arr[Math.floor(Math.random() * arr.length)] ?? arr[0]!;
}

/* ── Provider 2: z-ai (backend-only SDK) ─────────────────────────────────── */

async function zaiChat(system: string, history: Msg[]): Promise<string> {
  const zai = await ZAI.create();
  const completion = await zai.chat.completions.create({
    messages: [
      { role: "assistant", content: system },
      ...history.map((m) => ({ role: m.role, content: m.content })),
    ],
    thinking: { type: "disabled" },
  });
  const reply = (completion.choices?.[0]?.message?.content ?? "").trim().slice(0, 1500);
  if (!reply) throw new Error("empty completion");
  return reply;
}

/** Gemini when configured, z-ai otherwise — plain chat, no tools. */
export async function chatViaProvider(
  system: string,
  history: Msg[],
): Promise<{ reply: string; source: "gemini" | "zai" }> {
  const settings = await getAiSettings();
  if (settings) {
    try {
      const out = await geminiGenerate({
        apiKey: settings.apiKey,
        model: settings.model,
        system,
        contents: toGeminiContents(history),
      });
      if (out.text) return { reply: out.text.slice(0, 1500), source: "gemini" };
      throw new Error("empty gemini reply");
    } catch (e) {
      console.error("[ai] gemini failed → z-ai fallback:", e instanceof Error ? e.message : e);
    }
  }
  return { reply: await zaiChat(system, history), source: "zai" };
}

/** The psychology companion: provider chain + canned last resort. */
export async function psychReply(locale: string, history: Msg[]): Promise<{ reply: string; source: string }> {
  const system = await getAiPrompt("psych");
  try {
    return await chatViaProvider(system, history);
  } catch (e) {
    console.error("[ai] psych fallback to canned:", e);
    return { reply: pickFallback(FALLBACK_PSY, locale), source: "canned" };
  }
}

/* ── Account tools (function calling, signed-in users only) ─────────────── */

export type ToolUser = { id: string; email: string; name: string | null };

const TOOL_DECLS: GeminiFunctionDecl[] = [
  {
    name: "get_my_data",
    description: "Read the signed-in user's PreLife data: profile (name, weight, height, goal, activity), the active workout plan and their custom package requests. Use it before updating, or when the user asks what you know about them.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "update_my_profile",
    description: "Update the user's own profile data. Only include the fields to change. Weight changes are logged to history automatically.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Display name (1-100 chars)" },
        weightKg: { type: "number", description: "Weight in kilograms (20-400)" },
        heightCm: { type: "number", description: "Height in centimeters (80-260)" },
        birthYear: { type: "integer", description: "Birth year (1900-now)" },
        gender: { type: "string", enum: ["male", "female", "other"] },
        goal: { type: "string", enum: ["lose", "maintain", "gain", "fitness"] },
        activityLevel: { type: "string", enum: ["sedentary", "light", "moderate", "active", "athlete"] },
        fitnessLevel: { type: "string", enum: ["beginner", "intermediate", "advanced"] },
        workoutsPerWeek: { type: "integer", description: "Planned workouts per week (0-14)" },
      },
    },
  },
  {
    name: "create_my_workout_plan",
    description: "Create and activate a personal weekly workout plan for the user, replacing the previous one. Prefer registry exercise codes from the context; write names/reps/notes in the user's language.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        level: { type: "string", enum: ["Başlanğıc", "Orta", "İleri"] },
        totalWeeks: { type: "integer", description: "Plan length in weeks (4-16)" },
        focus: { type: "string", description: "One-line plan focus" },
        days: {
          type: "array",
          description: "1-7 training days",
          items: {
            type: "object",
            properties: {
              day: { type: "integer", description: "ISO weekday: 1=Monday … 7=Sunday" },
              focus: { type: "string" },
              exercises: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    ex: { type: "string", description: "Registry code, or empty string when not in the registry" },
                    name: { type: "string" },
                    sets: { type: "integer" },
                    reps: { type: "string", description: 'e.g. "8-10" or "40 saniyə"' },
                    rest: { type: "integer", description: "Rest seconds (0-300)" },
                    note: { type: "string", description: "Optional short coaching cue" },
                  },
                  required: ["name", "sets", "reps"],
                },
              },
            },
            required: ["day", "focus", "exercises"],
          },
        },
      },
      required: ["title", "days"],
    },
  },
  {
    name: "create_custom_package",
    description: "Create a custom subscription package request for the user. The price is computed server-side from the picked features and duration (1/3/6/12 months with 0/5/10/15% off).",
    parameters: {
      type: "object",
      properties: {
        features: {
          type: "array",
          items: { type: "string", enum: ["gym", "diet", "psych", "library", "ai", "videos", "coaching", "family"] },
        },
        months: { type: "integer", enum: [1, 3, 6, 12] },
      },
      required: ["features", "months"],
    },
  },
];

async function runTool(
  name: string,
  args: Record<string, unknown>,
  user: ToolUser,
  locale: string,
): Promise<Record<string, unknown>> {
  try {
    switch (name) {
      case "get_my_data": {
        const [profile, plan, packages] = await Promise.all([
          getProfileView(user.id),
          getActivePlan(user.id),
          listCustomPackages(user.id),
        ]);
        return {
          ok: true,
          email: user.email,
          profile,
          activePlan: plan,
          customPackages: packages.slice(0, 5),
        };
      }
      case "update_my_profile": {
        const patch: ProfilePatchIn = {};
        for (const key of ["name", "weightKg", "heightCm", "birthYear", "gender", "goal",
          "activityLevel", "fitnessLevel", "workoutsPerWeek"] as const) {
          if (args[key] !== undefined) patch[key] = args[key];
        }
        const profile = await updateProfile(user.id, patch);
        return { ok: true, profile };
      }
      case "create_my_workout_plan": {
        const plan = await saveChatPlan(user.id, args, locale);
        if (!plan) return { ok: false, error: "invalid_plan" };
        return { ok: true, plan };
      }
      case "create_custom_package": {
        const pkg = await createCustomPackage(user.id, args.features, args.months);
        return { ok: true, package: pkg };
      }
      default:
        return { ok: false, error: "unknown_tool" };
    }
  } catch (e) {
    const code = e instanceof Error && "status" in e
      ? (e as { code?: string }).code ?? "tool_failed"
      : "tool_failed";
    return { ok: false, error: code };
  }
}

/* ── Context (the signed-in user's situation) ────────────────────────────── */

const PAGE_LABELS: [RegExp, string][] = [
  [/^\/home\/?$/, "Home dashboard"],
  [/^\/gym\/?$/, "Gym / İdman (plan, shops, halls, equipment)"],
  [/^\/diet\/?$/, "Nutrition (diet)"],
  [/^\/diet\/plans\/?$/, "Nutrition → meal plans"],
  [/^\/diet\/recipes\/?$/, "Nutrition → recipes"],
  [/^\/diet\/places\/?$/, "Nutrition → venues"],
  [/^\/meditation\/?$/, "Psychology (meditation)"],
  [/^\/meditation\/mood\/?$/, "Psychology → mood tracking"],
  [/^\/meditation\/journal\/?$/, "Psychology → journal"],
  [/^\/meditation\/psychologists\/?$/, "Psychology → psychologists"],
  [/^\/meditation\/bookings\/?$/, "Psychology → my bookings"],
  [/^\/meditation\/practice\/?$/, "Psychology → practice media"],
  [/^\/meditation\/tdb\/?$/, "Psychology → TDB videos"],
  [/^\/library\/?$/, "Library (reading)"],
  [/^\/subscription\/?$/, "Subscription / packages"],
  [/^\/profile\/?$/, "Profile"],
  [/^\/settings\/?$/, "Settings"],
  [/^\/help\/?$/, "Help"],
];

function pageLabel(page?: string | null): string {
  if (!page) return "unknown";
  const stripped = page.replace(/^\/(az|en|ru)(?=\/|$)/, "") || "/";
  for (const [re, label] of PAGE_LABELS) {
    if (re.test(stripped)) return `${label} (${page})`;
  }
  return page;
}

async function buildContextBlock(user: ToolUser, page?: string | null): Promise<string> {
  const template = await getAiPrompt("context");
  const [profile, plan, pkg] = await Promise.all([
    profileSummaryLine(user.id),
    planSummaryLine(user.id),
    packageSummaryLine(user.id),
  ]);
  return template
    .replaceAll("{name}", user.name ?? user.email.split("@")[0]!)
    .replaceAll("{email}", user.email)
    .replaceAll("{profile}", profile)
    .replaceAll("{page}", pageLabel(page))
    .replaceAll("{plan}", plan)
    .replaceAll("{package}", pkg);
}

/* ── The main assistant (provider chain + tools + canned last resort) ───── */

export async function assistantReply(opts: {
  locale: string;
  history: Msg[];
  page?: string | null;
  user?: ToolUser | null;
}): Promise<{ reply: string; source: "gemini" | "zai" | "canned" }> {
  const system = await getAiPrompt("assistant");
  const context = opts.user ? `\n\n${await buildContextBlock(opts.user, opts.page)}` : "";
  const fullSystem = `${system}${context}`;

  const settings = await getAiSettings();
  if (settings) {
    try {
      const contents = toGeminiContents(opts.history);
      for (let round = 0; round < 5; round++) {
        const out = await geminiGenerate({
          apiKey: settings.apiKey,
          model: settings.model,
          system: fullSystem,
          contents,
          tools: opts.user ? TOOL_DECLS : undefined,
        });
        if (out.functionCalls.length && opts.user) {
          contents.push({
            role: "model",
            parts: out.functionCalls.map((fc) => ({ functionCall: fc })),
          });
          const responses: GeminiContent["parts"] = [];
          for (const fc of out.functionCalls) {
            responses.push({
              functionResponse: { name: fc.name, response: await runTool(fc.name, fc.args, opts.user, opts.locale) },
            });
          }
          contents.push({ role: "user", parts: responses });
          continue;
        }
        if (out.text) return { reply: out.text.slice(0, 1500), source: "gemini" };
        throw new Error("empty gemini reply");
      }
      throw new Error("tool loop budget exceeded");
    } catch (e) {
      console.error("[ai] gemini failed → z-ai fallback:", e instanceof Error ? e.message : e);
    }
  }

  try {
    const reply = await zaiChat(fullSystem, opts.history);
    return { reply, source: "zai" };
  } catch (e) {
    console.error("[ai] z-ai failed → canned reply:", e);
    return { reply: pickFallback(FALLBACK_CHAT, opts.locale), source: "canned" };
  }
}
