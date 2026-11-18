import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

type Msg = { role: "system" | "user" | "assistant"; content: string };

const SYSTEM = [
  "You are PreLife's calm in-app psychology companion.",
  "Voice: warm, grounded, non-judgmental; short replies (3-6 sentences).",
  "You offer practical self-help: breathing, grounding, sleep hygiene,",
  "reflection prompts, habit ideas. You are NOT a licensed clinician:",
  "never diagnose, never give medical advice or medication guidance.",
  "When a message suggests crisis, self-harm, abuse or severe distress,",
  "respond kindly, briefly and point the user to book a professional on",
  "the Psychologists page and to local emergency services.",
  "Answer in the same language as the user's message.",
].join(" ");

const FALLBACK: Record<string, string[]> = {
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
    "Я вас слышу. Начните с одной минуты дыхания: вдох 4 секунды, задержка 7, выдох 8. Четыре цикла обычно заметно снижают напряжение.",
    "Иногда самый спокойный шаг — самый маленький: выберите одну маленькую цель на сегодня — стакан воды, короткая прогулка или страница книги. Маленькое движение возвращает мыслям опору.",
    "Записать это — уже ценно. Откройте один из подсказок дневника и вылейте мысли на страницу — письмо помогает упорядочить эмоции.",
  ],
};

const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)]!;

/** POST /api/psych/ai — the supportive chat companion. Uses the
 *  z-ai SDK server-side; if the SDK is unavailable (e.g. a deploy without
 *  credentials) a calm canned reply keeps the UX alive. Body:
 *  { locale, messages: [{ role: "user" | "assistant", content }] }. */
export async function POST(req: Request) {
  const current = await getSession();
  if (!current) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
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

  if (history.length === 0 || history[history.length - 1].role !== "user") {
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
    console.error("[psychology:ai] falling back to canned reply:", err instanceof Error ? err.message : err);
    const bank = FALLBACK[locale] ?? FALLBACK.en!;
    return NextResponse.json({ reply: pick(bank), source: "canned" });
  }
}
