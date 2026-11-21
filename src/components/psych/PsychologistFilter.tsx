"use client";

import { usePathname, useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import type { PsyFormat, PsySpecialty, PsyWeekday } from "@/lib/psychology";

const SPECIALTIES: PsySpecialty[] = ["individual", "couples", "family", "child", "trauma", "group"];

/** The fit-search filter bar. State lives in the URL (?sp&days&from&to&fmt)
 *  so the server re-scores the catalog on every change and the result is
 *  shareable. Sorted "most → least suitable" happens server-side. */
export function PsychologistFilter({ dayNames, count }: { dayNames: Record<PsyWeekday, string>; count: number }) {
  const t = useTranslations("psychApp");
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const days = (sp.get("days") ?? "").split(",").filter(Boolean).map(Number) as PsyWeekday[];
  const specialty = (sp.get("sp") ?? "any") as PsySpecialty | "any";
  const format = (sp.get("fmt") ?? "any") as PsyFormat | "any";
  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(sp.toString());
    if (value === null || value === "" || value === "any") next.delete(key);
    else next.set(key, value);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const toggleDay = (d: PsyWeekday) => {
    const next = days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort();
    setParam("days", next.length > 0 ? next.join(",") : null);
  };

  return (
    <div className="psy-filters">
      <div className="psy-filter-row">
        <span className="lbl">{t("filterSpecialty")}</span>
        {["any", ...SPECIALTIES].map((s) => (
          <button
            key={s}
            type="button"
            className="filter"
            aria-pressed={specialty === s}
            onClick={() => setParam("sp", s)}
          >
            {s === "any" ? t("filterAny") : t(`specialty_${s}`)}
          </button>
        ))}
      </div>

      <div className="psy-filter-row">
        <span className="lbl">{t("filterDays")}</span>
        <fieldset className="daypick" aria-label={t("filterDays")}>
          {([1, 2, 3, 4, 5, 6] as PsyWeekday[]).map((d) => (
            <button key={d} type="button" aria-pressed={days.includes(d)} onClick={() => toggleDay(d)}>
              {dayNames[d]}
            </button>
          ))}
        </fieldset>
      </div>

      <div className="psy-filter-row">
        <span className="lbl">{t("filterHours")}</span>
        <span className="timepick">
          <input
            type="number" min={0} max={23} placeholder="18"
            value={from}
            onChange={(e) => setParam("from", e.target.value === "" ? null : e.target.value)}
            aria-label={t("filterFrom")}
          />
          <span aria-hidden>–</span>
          <input
            type="number" min={0} max={23} placeholder="20"
            value={to}
            onChange={(e) => setParam("to", e.target.value === "" ? null : e.target.value)}
            aria-label={t("filterTo")}
          />
        </span>
        <span className="lbl" style={{ marginLeft: ".5rem" }}>{t("filterFormat")}</span>
        {(["any", "online", "office"] as const).map((f) => (
          <button
            key={f}
            type="button"
            className="filter"
            aria-pressed={format === f}
            onClick={() => setParam("fmt", f)}
          >
            {f === "any" ? t("filterAny") : t(`format_${f}`)}
          </button>
        ))}
      </div>

      <p className="avail-note">{t("filterHint", { count })}</p>
    </div>
  );
}
