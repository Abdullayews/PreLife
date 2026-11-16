"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { LoaderCircle } from "lucide-react";
import type { DayColumn, SlotState } from "@/lib/diet";

type Props = {
  slug: string;
  price: number;
  columns: DayColumn[];
  dayNames: Record<string, string>;
  monthNames: Record<string, string>;
};

const hh = (hour: number) => `${String(hour).padStart(2, "0")}:00`;

/** The psychologist's two-week booking grid, styled on the diet world's
 *  .sched table: dashed sage cells are free (click → confirm bar), tinted
 *  cells are busy, solid accent cells are the user's own bookings. */
export function ScheduleBook({ slug, price, columns, dayNames, monthNames }: Props) {
  const t = useTranslations("dietApp");
  const router = useRouter();
  const [picked, setPicked] = useState<{ date: string; hour: number } | null>(null);
  const [mode, setMode] = useState<"online" | "office">("online");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const hours = [...new Set(columns.flatMap((c) => c.slots.map((s) => s.hour)).filter((h) => h > 0))].sort((a, b) => a - b);
  const at = (col: DayColumn, hour: number) => col.slots.find((s) => s.hour === hour);

  const label = (date: string) => {
    const d = new Date(`${date}T00:00:00Z`);
    const weekday = ((d.getUTCDay() + 6) % 7) + 1;
    return {
      day: dayNames[String(weekday)] ?? "",
      num: date.slice(8, 10),
      month: monthNames[String(d.getUTCMonth() + 1)] ?? "",
    };
  };

  const book = () => {
    if (!picked) return;
    setError("");
    start(async () => {
      const res = await fetch("/api/diet/book", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, date: picked.date, hour: picked.hour, mode }),
      });
      if (res.ok) {
        setPicked(null);
        router.refresh();
      } else {
        const data = (await res.json()) as { error?: string };
        setError(t(`bookError_${data.error ?? "generic"}`));
      }
    });
  };

  const cell = (col: DayColumn, hour: number) => {
    const slot = at(col, hour);
    const key = `${col.date}-${hour}`;
    if (!slot) return <td key={key} aria-hidden="true" />;
    const state: SlotState = slot.state;
    if (state === "free") {
      const active = picked?.date === col.date && picked?.hour === hour;
      return (
        <td key={key}>
          <button
            type="button"
            className={`cell cell-free${active ? " picked" : ""}`}
            aria-pressed={active}
            onClick={() => setPicked({ date: col.date, hour })}
          >
            {hh(hour)}
          </button>
        </td>
      );
    }
    if (state === "busy") {
      return <td key={key}><span className="cell cell-busy">{t("slotBusy")}</span></td>;
    }
    if (state === "mine") {
      return <td key={key}><span className="cell cell-mine">{t("slotMine")}</span></td>;
    }
    return <td key={key}><span className="cell cell-off" aria-hidden>·</span></td>;
  };

  return (
    <div className="psy-sched">
      <div className="sched-clip">
        <div className="sched-wrap" tabIndex={0} role="region" aria-label={t("scheduleA11y")}>
          <table className="sched">
            <thead>
              <tr>
                <th scope="col">{t("scheduleTime")}</th>
                {columns.map((c) => {
                  const l = label(c.date);
                  return (
                    <th key={c.date} scope="col">
                      <b>{l.day}</b> <span>{l.num} {l.month}</span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {hours.map((hour) => (
                <tr key={hour}>
                  <th scope="row"><b>{hh(hour)}</b></th>
                  {columns.map((c) => cell(c, hour))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="avail-note">{t("scheduleLegend")}</p>

      {picked && (
        <div className="psy-filters" role="form" aria-label={t("bookConfirmTitle")}>
          <div className="psy-filter-row">
            <span className="lbl">{t("bookConfirmTitle")}</span>
            <span className="fit-tag">
              {label(picked.date).day} {picked.date.slice(8, 10)} · {hh(picked.hour)}
            </span>
            <div className="seg" role="group" aria-label={t("filterFormat")}>
              {(["online", "office"] as const).map((m) => (
                <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}>
                  {t(`format_${m}`)}
                </button>
              ))}
            </div>
            <span className="lbl">{price} AZN</span>
            <button type="button" className="btn btn-sm" onClick={book} disabled={pending}>
              {pending && <LoaderCircle size={14} className="spin" aria-hidden />}
              {t("bookConfirm")}
            </button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setPicked(null)}>
              {t("bookCancelPick")}
            </button>
          </div>
        </div>
      )}
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
