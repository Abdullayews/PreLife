"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { LoaderCircle, PenLine } from "lucide-react";

/** Journal writer — the day prompt (already translated on the server) plus
 *  the prompt's MESSAGE KEY (e.g. "journalPrompt3"). The key is what gets
 *  stored on the entry, so the archive can re-translate the exact prompt
 *  the entry was written under in any locale — it never drifts to a later
 *  day's prompt. Saves via POST /api/psych/journal. */
export function JournalCard({ prompt, promptKey }: { prompt: string; promptKey: string }) {
  const t = useTranslations("psychApp");
  const router = useRouter();
  const [content, setContent] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      setError(false);
      const res = await fetch("/api/psych/journal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content, promptKey }),
      });
      if (res.ok) {
        setContent("");
        setSaved(true);
        router.refresh();
      } else {
        setError(true);
      }
    });

  return (
    <div className="card jrnl">
      <div className="card-top">
        <span className="chip-ico tinted"><PenLine size={20} aria-hidden /></span>
        <span className="eyebrow">{t("journalEyebrow")}</span>
      </div>
      <p className="quote-mini">{prompt}</p>
      <textarea
        value={content}
        onChange={(e) => { setContent(e.target.value); setSaved(false); }}
        placeholder={t("journalPlaceholder")}
        maxLength={4000}
        aria-label={t("journalEyebrow")}
      />
      <div className="psy-actions">
        <button type="button" className="btn" onClick={save} disabled={content.trim().length === 0 || pending}>
          {pending && <LoaderCircle size={16} className="spin" aria-hidden />}
          {t("journalSave")}
        </button>
        {saved && <span className="mood-state">{t("journalSaved")}</span>}
        {error && <span className="mood-state">{t("errorGeneric")}</span>}
      </div>
    </div>
  );
}
