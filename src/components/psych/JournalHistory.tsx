"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CalendarDays, ChevronLeft, ChevronRight, Flower2 } from "lucide-react";

/** One day of the journal history — entries pre-translated and
 *  pre-formatted server-side, plus that day's mood check-in line. */
export type JournalDay = {
  /** "YYYY-MM-DD" (Baku). */
  date: string;
  /** Human date label, formatted in-locale server-side. */
  label: string;
  /** "Mood 4/5 · Energy 3/5 · Sleep 5/5" — null when no check-in. */
  mood: string | null;
  entries: { id: string; createdAt: string; prompt: string | null; content: string }[];
};

/** The full-history day navigator: pick any past day (arrows, calendar
 *  picker or the Today chip) and read what you wrote — and how you
 *  felt — that day. The write-card above still targets today only. */
export function JournalHistory({
  days, today, minDate,
}: {
  /** Days that have data, newest first. */
  days: JournalDay[];
  /** Today's "YYYY-MM-DD" — the navigator's default and upper bound. */
  today: string;
  /** The earliest date the picker allows (earliest entry or account). */
  minDate: string;
}) {
  const t = useTranslations("psychApp");
  const locale = useLocale();
  const [selected, setSelected] = useState(today);

  const byDate = useMemo(
    () => new Map(days.map((d) => [d.date, d])),
    [days],
  );

  const shift = (dir: 1 | -1) => {
    const d = new Date(`${selected}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + dir);
    const next = d.toISOString().slice(0, 10);
    if (next >= minDate && next <= today) setSelected(next);
  };

  /* The label: pre-formatted when the day has one, otherwise built from
   *  the raw date parts — formatted in the VISITOR's locale (v4.7: it
   *  used to be hardcoded "az" and showed Azerbaijani weekday names to
   *  EN/RU visitors). */
  const day = byDate.get(selected);
  const label = day
    ? day.label
    : new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" })
        .format(new Date(`${selected}T12:00:00Z`));

  return (
    <div className="jrnl-history">
      <fieldset className="jrnl-nav" aria-label={t("journalHistoryEyebrow")}>
        <button
          type="button"
          className="icon-btn"
          onClick={() => shift(-1)}
          disabled={selected <= minDate}
          aria-label={t("journalDayPrev")}
        >
          <ChevronLeft size={18} aria-hidden />
        </button>
        <label className="jrnl-date">
          <CalendarDays size={16} aria-hidden />
          <span>{selected === today ? t("journalDayToday") : label}</span>
          <span className="sr-only">{t("journalPickDate")}</span>
          <input
            type="date"
            value={selected}
            min={minDate}
            max={today}
            onChange={(e) => { if (e.target.value) setSelected(e.target.value); }}
            aria-label={t("journalPickDate")}
          />
        </label>
        <button
          type="button"
          className="icon-btn"
          onClick={() => shift(1)}
          disabled={selected >= today}
          aria-label={t("journalDayNext")}
        >
          <ChevronRight size={18} aria-hidden />
        </button>
      </fieldset>

      {day?.mood && (
        <p className="jrnl-mood">
          <Flower2 size={15} aria-hidden />
          <b>{t("journalMoodOfDay")}:</b> {day.mood}
        </p>
      )}

      {day && day.entries.length > 0 ? (
        <ul className="jrnl" aria-live="polite">
          {day.entries.map((e) => (
            <li key={e.id} className="jrnl-entry">
              <div className="row">
                <time>{e.createdAt}</time>
                {e.prompt && <span className="tag tinted">{e.prompt}</span>}
              </div>
              <p>{e.content}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="jrnl-empty">{t("journalNoDay")}</p>
      )}
    </div>
  );
}
