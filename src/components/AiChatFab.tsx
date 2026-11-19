"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { apiUrl } from "@/lib/api-url";
import { LoaderCircle, Send, Sparkles, X } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string };

/**
 * The floating PreLife AI assistant — a round action button pinned to
 * the viewport's bottom-right corner (above the safe area). One tap
 * opens the chat panel; the X in its header (or Escape) closes it.
 * History lives in memory only — nothing is stored server-side.
 *
 * Mounted GLOBALLY for signed-in users (the [locale] layout) so the
 * assistant is available on every tab and subtab, plus on the public
 * welcome surface for guests. The current page rides along with every
 * request, so the backend builds a context-aware system prompt — and
 * for signed-in users the assistant can ACT on the account (profile,
 * plan, package) through the Gemini function tools.
 */
export function AiChatFab({ signedIn = false }: { signedIn?: boolean }) {
  const t = useTranslations("aiChat");
  const locale = useLocale();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  /* Keep the log scrolled to the newest message. */
  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages, busy, open]);

  /* Escape closes the panel. */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || busy) return;
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch(apiUrl("/api/ai/chat"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locale, messages: next, page: pathname }),
      });
      const data = (await res.json()) as { reply?: string };
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply ?? t("error") },
      ]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: t("error") }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* The panel — above the button, bottom-right. */}
      {open && (
        <section className="ai-fab-panel" aria-label={t("title")}>
          <header className="ai-fab-head">
            <span className="chip-ico solid"><Sparkles size={18} aria-hidden /></span>
            <div>
              <b>{t("title")}</b>
              <span>{t("subtitle")}</span>
            </div>
            <button
              type="button"
              className="ai-fab-x"
              aria-label={t("close")}
              onClick={() => setOpen(false)}
            >
              <X size={18} aria-hidden />
            </button>
          </header>

          <div className="ai-fab-log" ref={logRef}>
            {messages.length === 0 && (
              <>
                <p className="ai-fab-intro">{t("intro")}</p>
                {signedIn && <p className="ai-fab-intro dim">{t("toolsHint")}</p>}
              </>
            )}
            {messages.map((m, i) => (
              <p key={i} className={`ai-fab-msg ${m.role === "user" ? "user" : "ai"}`}>{m.content}</p>
            ))}
            {busy && (
              <p className="ai-fab-msg ai" aria-live="polite">
                <LoaderCircle size={14} className="spin" aria-hidden /> {t("thinking")}
              </p>
            )}
          </div>

          {messages.length === 0 && (
            <div className="ai-fab-chips">
              {(["chip1", "chip2", "chip3"] as const).map((key) => (
                <button key={key} type="button" onClick={() => void send(t(key))}>
                  {t(key)}
                </button>
              ))}
            </div>
          )}

          <form
            className="ai-fab-form"
            onSubmit={(e) => { e.preventDefault(); void send(input); }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t("placeholder")}
              aria-label={t("placeholder")}
              maxLength={600}
            />
            <button
              type="submit"
              className="ai-fab-send"
              disabled={busy || input.trim().length === 0}
              aria-label={t("send")}
            >
              <Send size={16} aria-hidden />
            </button>
          </form>
          <p className="ai-fab-note">{t("disclaimer")}</p>
        </section>
      )}

      {/* The button itself — pinned bottom-right, above the safe area. */}
      <button
        type="button"
        className="ai-fab-btn"
        aria-expanded={open}
        aria-label={open ? t("close") : t("open")}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X size={22} aria-hidden /> : <Sparkles size={22} aria-hidden />}
      </button>
    </>
  );
}
