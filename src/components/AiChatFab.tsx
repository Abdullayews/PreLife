"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { apiUrl } from "@/lib/api-url";
import { LoaderCircle, Send, Sparkles, X } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string; failed?: boolean };

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
 * preferences, plan, package) through the Gemini function tools.
 *
 * Honest-failure UX: when the assistant cannot think of an answer
 * (HTTP failure — esp. 503 ai_unavailable), NO fake reply is shown.
 * The user's message stays in the log and a failure bubble appears
 * with a retry button that re-sends the last user message.
 *
 * v4 motion: the panel stays MOUNTED and flips data-open — an
 * origin-aware entrance (scale .96 from the FAB corner, 250ms in /
 * 180ms out), with each new message rising in at 250ms. The content
 * mounts on first open and stays (re-open is instant, no re-animate
 * of the history).
 */
export function AiChatFab({ signedIn = false }: { signedIn?: boolean }) {
  const t = useTranslations("aiChat");
  const locale = useLocale();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [everOpened, setEverOpened] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /* Keep the log scrolled to the newest message. */
  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages, busy, open]);

  /* First open: mount the content; on fine pointers also focus the
   * composer (mobile keyboards should not jump open on their own). */
  useEffect(() => {
    if (!open) return;
    setEverOpened(true);
    const id = window.setTimeout(() => {
      if (window.matchMedia("(pointer: fine)").matches) inputRef.current?.focus();
    }, 140);
    return () => window.clearTimeout(id);
  }, [open]);

  /* Escape closes the panel. */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  /** POST the wire history (failure bubbles never go on the wire) and
   *  return the reply text — or null when the assistant could not think,
   *  so the caller can show the honest failure bubble instead. */
  const post = async (wire: Msg[]): Promise<string | null> => {
    const res = await fetch(apiUrl("/api/ai/chat"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ locale, messages: wire, page: pathname }),
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
        setMessages((prev) => [...prev, { role: "assistant", content: t("unavailable"), failed: true }]);
        return;
      }
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: t("unavailable"), failed: true }]);
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
    <>
      {/* The panel — above the button, bottom-right. Persistently
          mounted; data-open drives the CSS entrance/exit. `inert` keeps
          the closed panel out of the tab order. */}
      <section
        className="ai-fab-panel"
        data-open={open ? "true" : "false"}
        aria-label={t("title")}
        inert={!open}
      >
        {everOpened && (
          <>
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
              {messages.map((m, i) =>
                m.failed ? (
                  <p key={i} className="ai-fab-msg ai">
                    <span>{m.content}</span>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => void retry()}
                      disabled={busy}
                    >
                      {t("retry")}
                    </button>
                  </p>
                ) : (
                  <p key={i} className={`ai-fab-msg ${m.role === "user" ? "user" : "ai"}`}>{m.content}</p>
                ),
              )}
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
                ref={inputRef}
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
          </>
        )}
      </section>

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
