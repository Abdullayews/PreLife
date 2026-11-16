"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { MOOD_TAGS } from "@/lib/diet";
import { LoaderCircle } from "lucide-react";

export type MoodInitial = {
  mood: number; energy: number; sleepQ: number;
  tags: string[]; note: string;
} | null;

/** Daily check-in: mood / energy / sleep on 1–5 scales (+ tags & note on
 *  the full version). Posts to /api/diet/mood as an upsert. */
export function MoodCheck({ initial, compact = false }: { initial: MoodInitial; compact?: boolean }) {
  const t = useTranslations("dietApp");
  const router = useRouter();
  const [mood, setMood] = useState(initial?.mood ?? 0);
  const [energy, setEnergy] = useState(initial?.energy ?? 0);
  const [sleepQ, setSleepQ] = useState(initial?.sleepQ ?? 0);
  const [tags, setTags] = useState<Set<string>>(new Set(initial?.tags ?? []));
  const [note, setNote] = useState(initial?.note ?? "");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();

  const ready = mood > 0 && energy > 0 && sleepQ > 0;

  const toggleTag = (tag: string) => {
    setTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else if (next.size < 5) next.add(tag);
      return next;
    });
    setSaved(false);
  };

  const save = () =>
    start(async () => {
      setError(false);
      const res = await fetch("/api/diet/mood", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mood, energy, sleepQ, tags: [...tags], note }),
      });
      if (res.ok) {
        setSaved(true);
        router.refresh();
      } else {
        setError(true);
      }
    });

  const row = (label: string, value: number, set: (n: number) => void) => (
    <div className="mood-row">
      <label>{label}</label>
      <div className="mood-dots" role="group" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" aria-pressed={value === n} onClick={() => { set(n); setSaved(false); }}>
            {n}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="mood-grid">
      {row(t("moodScaleMood"), mood, setMood)}
      {row(t("moodScaleEnergy"), energy, setEnergy)}
      {row(t("moodScaleSleep"), sleepQ, setSleepQ)}

      {!compact && (
        <>
          <div className="mood-row">
            <label>{t("moodTagsLabel")}</label>
            <ul className="chips">
              {MOOD_TAGS.map((tag) => (
                <li key={tag}>
                  <button
                    type="button"
                    className="filter"
                    aria-pressed={tags.has(tag)}
                    onClick={() => toggleTag(tag)}
                  >
                    {t(`moodTag_${tag}`)}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="mood-row">
            <label htmlFor="mood-note">{t("moodNoteLabel")}</label>
            <textarea
              id="mood-note"
              className="mood-note"
              maxLength={280}
              value={note}
              onChange={(e) => { setNote(e.target.value); setSaved(false); }}
              placeholder={t("moodNotePlaceholder")}
            />
          </div>
        </>
      )}

      <div className="psy-actions">
        <button type="button" className="btn" onClick={save} disabled={!ready || pending}>
          {pending && <LoaderCircle size={16} className="spin" aria-hidden />}
          {initial ? t("moodUpdate") : t("moodSave")}
        </button>
        {saved && <span className="mood-state">{t("moodSaved")}</span>}
        {error && <span className="mood-state">{t("errorGeneric")}</span>}
      </div>
    </div>
  );
}
