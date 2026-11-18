"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { LoaderCircle, Send, Sparkles } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string };

/** The supportive AI companion panel. History is kept in memory only —
 *  nothing is stored server-side (privacy first). The API adds its own
 *  system prompt and crisis-guidance rules. */
export function AiPanel() {
  const t = useTranslations("psychApp");
  const locale = useLocale();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages, busy]);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || busy) return;
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/psych/ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locale, messages: next }),
      });
      const data = (await res.json()) as { reply?: string };
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply ?? t("errorGeneric") },
      ]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: t("errorGeneric") }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card chat">
      <div className="card-top">
        <span className="chip-ico tinted"><Sparkles size={20} aria-hidden /></span>
        <span className="eyebrow">{t("aiEyebrow")}</span>
      </div>

      <div className="chat-log" ref={logRef}>
        {messages.length === 0 && <p className="lede">{t("aiIntro")}</p>}
        {messages.map((m, i) => (
          <p key={i} className={`chat-msg ${m.role === "user" ? "user" : "ai"}`}>{m.content}</p>
        ))}
        {busy && (
          <p className="chat-msg ai" aria-live="polite">
            <LoaderCircle size={14} className="spin" aria-hidden /> {t("aiThinking")}
          </p>
        )}
      </div>

      <div className="chat-chips">
        {(["aiChip1", "aiChip2", "aiChip3", "aiChip4"] as const).map((key) => (
          <button key={key} type="button" onClick={() => void send(t(key))}>
            {t(key)}
          </button>
        ))}
      </div>

      <form
        className="chat-form"
        onSubmit={(e) => { e.preventDefault(); void send(input); }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("aiPlaceholder")}
          aria-label={t("aiPlaceholder")}
          maxLength={600}
        />
        <button type="submit" className="btn btn-sm" disabled={busy || input.trim().length === 0} aria-label={t("aiSend")}>
          <Send size={16} aria-hidden />
        </button>
      </form>
      <p className="chat-disclaim">{t("aiDisclaimer")}</p>
    </div>
  );
}
