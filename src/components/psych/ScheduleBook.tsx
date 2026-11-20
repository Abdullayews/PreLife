"use client";

import { useState, useTransition, type CSSProperties } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { apiUrl } from "@/lib/api-url";
import { LoaderCircle } from "lucide-react";
import { toast } from "@/components/Toaster";
import { bakuParts, shiftDate, type DayColumn, type SlotState } from "@/lib/psychology";

type Props = {
  slug: string;
  price: number;
  columns: DayColumn[];
  dayNames: Record<string, string>;
  monthNames: Record<string, string>;
};

const hh = (hour: number) => `${String(hour).padStart(2, "0")}:00`;

// Baku "today" — computed per render (a client tab open across Baku
// midnight must not keep yesterday's min/max on the custom-date input; the
// cost is one cheap pure call).
function useBakuToday() {
  const [today] = useState(() => bakuParts(new Date()).date);
  return today;
}

/** The control look shared with the filter bar's .timepick inputs (no bare
 * input/select class exists outside .timepick, so the tokens are inlined). */
const CONTROL: CSSProperties = {
  height: "2.25rem",
  paddingInline: ".6rem",
  border: "1px solid var(--line-strong)",
  borderRadius: "12px",
  background: "var(--surface)",
  font: "inherit",
  fontSize: ".875rem",
  color: "var(--ink)",
};

/** The psychologist's two-week booking grid, styled on the diet world's
 *  .sched table: dashed sage cells are free (click → request form), tinted
 *  cells are busy, solid accent cells are the user's own bookings. Since
 *  v3.4 every booking starts as a REQUEST: the client writes what they
 *  want, the psychologist confirms it from their console, and only then
 *  does payment open. Below the legend, a custom-time form lets the client
 *  propose any hour of the next 60 days (06:00–23:00, psychologist
 *  decides). */
export function ScheduleBook({ slug, price, columns, dayNames, monthNames }: Props) {
  const t = useTranslations("psychApp");
  const router = useRouter();
  const TODAY = useBakuToday();
  const [picked, setPicked] = useState<{ date: string; hour: number } | null>(null);
  const [mode, setMode] = useState<"online" | "office">("online");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  // The custom-time form (always visible below the legend).
  const [cDate, setCDate] = useState("");
  const [cHour, setCHour] = useState("09");
  const [cMode, setCMode] = useState<"online" | "office">("online");
  const [cMessage, setCMessage] = useState("");
  const [cError, setCError] = useState("");
  const [cPending, startCustom] = useTransition();

  const hours = [...new Set(columns.flatMap((c) => c.slots.map((s) => s.hour)).filter((h) => h > 0))].sort((a, b) => a - b);
  const at = (col: DayColumn, hour: number) => col.slots.find((s) => s.hour === hour);

  // The custom date window is [tomorrow, today + 60 days], mirroring the
  // server-side bounds.
  const minDate = shiftDate(TODAY, 1);
  const maxDate = shiftDate(TODAY, 60);

  const label = (date: string) => {
    const d = new Date(`${date}T00:00:00Z`);
    const weekday = ((d.getUTCDay() + 6) % 7) + 1;
    return {
      day: dayNames[String(weekday)] ?? "",
      num: date.slice(8, 10),
      month: monthNames[String(d.getUTCMonth() + 1)] ?? "",
    };
  };

  const send = () => {
    if (!picked) return;
    setError("");
    start(async () => {
      const res = await fetch(apiUrl("/api/psych/book"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, date: picked.date, hour: picked.hour, mode, message }),
      });
      if (res.ok) {
        setPicked(null);
        setMessage("");
        toast(t("requestSent"));
        router.refresh();
      } else {
        const data = (await res.json()) as { error?: string };
        // A code the catalog lacks (server-side additions) falls back to the
        // generic message instead of rendering a raw i18n key.
        const code = data.error && t.has(`bookError_${data.error}`) ? `bookError_${data.error}` : "bookError_generic";
        setError(t(code));
      }
    });
  };

  const sendCustom = () => {
    if (!cDate) return;
    setCError("");
    startCustom(async () => {
      const res = await fetch(apiUrl("/api/psych/book"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug, date: cDate, hour: Number(cHour), mode: cMode, message: cMessage, custom: true,
        }),
      });
      if (res.ok) {
        setCDate("");
        setCMessage("");
        toast(t("requestSent"));
        router.refresh();
      } else {
        const data = (await res.json()) as { error?: string };
        const code = data.error && t.has(`bookError_${data.error}`) ? `bookError_${data.error}` : "bookError_generic";
        setCError(t(code));
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
            aria-label={`${t("reserve")} · ${hh(hour)}`}
            onClick={() => setPicked({ date: col.date, hour })}
          >
            <b style={{ display: "block", fontVariantNumeric: "tabular-nums" }}>{hh(hour)}</b>
            <span style={{ display: "block", fontSize: ".75rem", fontWeight: 650, lineHeight: 1.2, letterSpacing: ".04em", overflowWrap: "anywhere" }}>
              {t("reserve")}
            </span>
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

      {/* ── The request form for a picked grid slot ── */}
      {picked && (
        <form
          className="psy-filters"
          aria-label={t("requestTitle")}
          onSubmit={(e) => { e.preventDefault(); send(); }}
        >
          <div className="psy-filter-row">
            <span className="lbl">{t("requestTitle")}</span>
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
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => { setPicked(null); setMessage(""); setError(""); }}
            >
              {t("bookCancelPick")}
            </button>
          </div>
          <p className="avail-note" style={{ margin: 0 }}>{t("requestHint")}</p>
          <textarea
            className="mood-note"
            placeholder={t("messagePlaceholder")}
            aria-label={t("messageLabel")}
            maxLength={1000}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <div className="psy-filter-row">
            <button
              type="button"
              className="btn btn-sm"
              onClick={send}
              disabled={pending || message.trim().length === 0}
            >
              {pending && <LoaderCircle size={14} className="spin" aria-hidden />}
              {t("sendRequest")}
            </button>
          </div>
          {error && <p className="field-error" style={{ margin: 0 }}>{error}</p>}
        </form>
      )}

      {/* ── Custom time: propose any hour of the next 60 days ── */}
      <section className="psy-filters" aria-label={t("customTitle")}>
        <div className="psy-filter-row">
          <span className="lbl" style={{ marginRight: 0, color: "var(--ink)", fontSize: ".9375rem" }}>
            {t("customTitle")}
          </span>
        </div>
        <p className="avail-note" style={{ margin: 0 }}>{t("customHint")}</p>
        <div className="psy-filter-row">
          <label className="lbl" htmlFor={`custom-date-${slug}`}>{t("customDate")}</label>
          <input
            id={`custom-date-${slug}`}
            type="date"
            min={minDate}
            max={maxDate}
            value={cDate}
            onChange={(e) => { setCDate(e.target.value); setCError(""); }}
            style={CONTROL}
          />
          <label className="lbl" htmlFor={`custom-hour-${slug}`} style={{ marginLeft: ".5rem" }}>
            {t("customHour")}
          </label>
          <select
            id={`custom-hour-${slug}`}
            value={cHour}
            onChange={(e) => setCHour(e.target.value)}
            style={CONTROL}
          >
            {Array.from({ length: 18 }, (_, i) => i + 6).map((h) => (
              <option key={h} value={String(h)}>{hh(h)}</option>
            ))}
          </select>
          <div className="seg" role="group" aria-label={t("filterFormat")}>
            {(["online", "office"] as const).map((m) => (
              <button key={m} type="button" aria-pressed={cMode === m} onClick={() => setCMode(m)}>
                {t(`format_${m}`)}
              </button>
            ))}
          </div>
          <span className="lbl">{price} AZN</span>
        </div>
        <textarea
          className="mood-note"
          placeholder={t("messagePlaceholder")}
          aria-label={t("messageLabel")}
          maxLength={1000}
          value={cMessage}
          onChange={(e) => setCMessage(e.target.value)}
        />
        <div className="psy-filter-row">
          <button
            type="button"
            className="btn btn-sm"
            onClick={sendCustom}
            disabled={cPending || !cDate || cMessage.trim().length === 0}
          >
            {cPending && <LoaderCircle size={14} className="spin" aria-hidden />}
            {t("sendRequest")}
          </button>
        </div>
        {cError && <p className="field-error" style={{ margin: 0 }}>{cError}</p>}
      </section>
    </div>
  );
}
