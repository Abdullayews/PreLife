import { NextResponse } from "next/server";

type Msg = { role: "system" | "user" | "assistant"; content: string };

const SYSTEM = [
  "You are PreLife's assistant — a calm, encouraging companion for a",
  "life-platform that covers four worlds: fitness (gym plans, partner",
  "halls, equipment shopping), nutrition (meal plans, recipes),",
  "psychology (psychologists, mood tracking, journaling, meditation)",
  "and reading (books, collections).",
  "Voice: warm, grounded, concise (3-6 sentences). You help the visitor",
  "understand WHAT THEY CAN DO on the platform and guide them to the",
  "right section. For fitness you may give safe general training tips;",
  "for nutrition, general balanced-eating guidance; for psychology,",
  "supportive self-help (breathing, grounding, sleep hygiene) — never",
  "diagnose, never give medical or medication advice. When a message",
  "suggests crisis or severe distress, respond kindly and briefly point",
  "to a professional and local emergency services.",
  "Answer in the same language as the user's message.",
].join(" ");

const FALLBACK: Record<string, string[]> = {
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

const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)]!;

/** POST /api/ai/chat — the floating PreLife assistant used by the
 *  welcome (public) and home (signed-in) surfaces. Uses the z-ai SDK
 *  server-side; if the SDK is unavailable a calm canned reply keeps the
 *  UX alive. Body: { locale, messages: [{ role, content }] }. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    locale?: unknown; messages?: unknown;
  };
  const locale = typeof body.locale === "string" && ["az", "en", "ru"].includes(body.locale) ? body.locale : "en";
  const raw = Array.isArray(body.messages) ? body.messages : [];
  const history: Msg[] = raw
    .filter((m): m is { role: string; content: string } =>
      typeof m === "object" && m !== null
      && typeof (m as { content?: unknown }).content === "string"
      && ((m as { role?: unknown }).role === "user" || (m as { role?: unknown }).role === "assistant"))
    .slice(-8)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content.slice(0, 1200) }));

  if (history.length === 0 || history[history.length - 1]!.role !== "user") {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  try {
    const { default: ZAI } = await import("z-ai-web-dev-sdk");
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [{ role: "system", content: SYSTEM }, ...history],
      thinking: { type: "disabled" },
    });
    const reply: string = typeof completion?.choices?.[0]?.message?.content === "string"
      ? completion.choices[0].message.content.trim().slice(0, 1500)
      : "";
    if (reply) return NextResponse.json({ reply, source: "ai" });
    throw new Error("empty completion");
  } catch (err) {
    console.error("[ai:chat] falling back to canned reply:", err instanceof Error ? err.message : err);
    const bank = FALLBACK[locale] ?? FALLBACK.en!;
    return NextResponse.json({ reply: pick(bank), source: "canned" });
  }
}
