"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { apiUrl } from "@/lib/api-url";
import { LoaderCircle, Send, Sparkles } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string; failed?: boolean };

/** The supportive AI companion panel. History is kept in memory only —
 *  nothing is stored server-side (privacy first). The API adds its own
 *  system prompt and crisis-guidance rules.
 *
 *  Honest-failure UX: when the companion cannot think of an answer
 *  (HTTP failure — esp. 503 ai_unavailable), NO fake reply is shown.
 *  The user's message stays in the log and a failure bubble appears
 *  with a retry button that re-sends the last user message. */
export function AiPanel() {
  const t = useTranslations("psychApp");
  // unavailable/retry live in the shared aiChat namespace (all locales).
  const tAi = useTranslations("aiChat");
  const locale = useLocale();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages, busy]);

  /** POST the wire history (failure bubbles never go on the wire) and
   *  return the reply text — or null when the companion could not think,
   *  so the caller can show the honest failure bubble instead. */
  const post = async (wire: Msg[]): Promise<string | null> => {
    const res = await fetch(apiUrl("/api/psych/ai"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ locale, messages: wire }),
    });
    const data = (await res.json().catch(() => null)) as { reply?: string } | null;
    return res.ok && typeof data?.reply === "string" && data.reply ? data.reply : null;
  };

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || busy) return;
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const reply = await post(next.filter((m) => !m.failed));
      if (reply === null) {
        setMessages((prev) => [...prev, { role: "assistant", content: tAi("unavailable"), failed: true }]);
        return;
      }
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: tAi("unavailable"), failed: true }]);
    } finally {
      setBusy(false);
    }
  };

  /** Re-send the LAST user message after a failure. On success the
   *  trailing failure bubble is replaced by the real reply; on failure
   *  it stays as-is (retry stays available) — nothing is invented. */
  const retry = async () => {
    if (busy) return;
    let lastUser = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]!.role === "user") { lastUser = i; break; }
    }
    if (lastUser === -1) return;
    const wire = messages.slice(0, lastUser + 1).filter((m) => !m.failed);
    setBusy(true);
    try {
      const reply = await post(wire);
      if (reply !== null) {
        setMessages((prev) => {
          const trimmed = [...prev];
          while (trimmed.length > 0 && trimmed[trimmed.length - 1]!.failed) trimmed.pop();
          return [...trimmed, { role: "assistant", content: reply }];
        });
      }
    } catch {
      /* the failure bubble + retry button stay — the user can try again */
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
        {messages.map((m, i) =>
          m.failed ? (
            <p key={i} className="chat-msg ai">
              {m.content}{" "}
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => void retry()}
                disabled={busy}
              >
                {tAi("retry")}
              </button>
            </p>
          ) : (
            <p key={i} className={`chat-msg ${m.role === "user" ? "user" : "ai"}`}>{m.content}</p>
          ),
        )}
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
