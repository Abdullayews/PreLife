import ZAI from "z-ai-web-dev-sdk";

/**
 * AI chat — the direct port of the Rust ai.rs, now on the official
 * z-ai-web-dev-sdk (backend-only). Same system prompts, same canned
 * fallbacks per locale, same request validation and trimming.
 */

export const SYSTEM_CHAT =
  "You are PreLife's assistant — a calm, encouraging companion for a life-platform that covers four worlds: fitness (gym plans, partner halls, equipment shopping), nutrition (meal plans, recipes), psychology (psychologists, mood tracking, journaling, meditation) and reading (books, collections). Voice: warm, grounded, concise (3-6 sentences). You help the visitor understand WHAT THEY CAN DO on the platform and guide them to the right section. For fitness you may give safe general training tips; for nutrition, general balanced-eating guidance; for psychology, supportive self-help (breathing, grounding, sleep hygiene) — never diagnose, never give medical or medication advice. When a message suggests crisis or severe distress, respond kindly and briefly point to a professional and local emergency services. Answer in the same language as the user's message.";

export const SYSTEM_PSY =
  "You are PreLife's calm in-app psychology companion. Voice: warm, grounded, non-judgmental; short replies (3-6 sentences). You offer practical self-help: breathing, grounding, sleep hygiene, reflection prompts, habit ideas. You are NOT a licensed clinician: never diagnose, never give medical advice or medication guidance. When a message suggests crisis, self-harm, abuse or severe distress, respond kindly, briefly and point the user to book a professional on the Psychologists page and to local emergency services. Answer in the same language as the user's message.";

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
    "Иногда самый спокойный шаг — самый маленький: выберите одну маленькую цель на сегодня — стакан воды, короткая прогулка или страница книги. Маленькое движение возвращает мыслям опору.",
    "Записать это — уже ценно. Откройте один из подсказок дневника и вылейте мысли на страницу — письмо помогает упорядочить эмоции.",
  ],
};

/* ── z-ai chat completion (backend-only SDK) ─────────────────────────────── */

type Msg = { role: "user" | "assistant"; content: string };

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

/* ── Shared request shape ────────────────────────────────────────────────── */

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
  if (trimmed.length === 0 || trimmed[trimmed.length - 1].role !== "user") {
    throw new Error("invalid");
  }
  return { locale, history: trimmed };
}

type Row2 = { role?: unknown; content?: unknown };

function pickFallback(bank: Record<string, string[]>, locale: string): string {
  const arr = bank[locale] ?? bank.en;
  return arr[Math.floor(Math.random() * arr.length)] ?? arr[0];
}

/* ── Shared completion with canned fallback ──────────────────────────────── */

export async function chatReply(
  system: string,
  fallbackBank: Record<string, string[]>,
  locale: string,
  history: Msg[],
): Promise<{ reply: string; source: "ai" | "canned" }> {
  try {
    const reply = await zaiChat(system, history);
    return { reply, source: "ai" };
  } catch (e) {
    console.error("[ai] falling back to canned reply:", e);
    return { reply: pickFallback(fallbackBank, locale), source: "canned" };
  }
}
