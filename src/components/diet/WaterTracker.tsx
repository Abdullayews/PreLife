"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CupSoda } from "lucide-react";
import { hasConsent } from "@/lib/consent";

/** Today's "YYYY-MM-DD" in Baku wall time (en-CA renders that shape). */
const bakuTodayStr = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Baku" }).format(new Date());

const LS_KEY = "pl:diet:water";

/** Eight-glass water tracker — tap a glass to fill it, tap again to
 * empty. The count is consent-gated localStorage keyed by today's Baku
 * date, so a new day starts clean. */
export function WaterTracker() {
  const t = useTranslations("dietApp");
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!hasConsent()) return;
    try {
      const raw = localStorage.getItem(LS_KEY);
      const [date, value] = raw?.split("|") ?? ["", ""];
      if (date === bakuTodayStr()) setCount(Math.min(8, Math.max(0, Number(value) || 0)));
    } catch { /* private mode */ }
  }, []);

  const set = (n: number) => {
    const clamped = Math.min(8, Math.max(0, n));
    setCount(clamped);
    if (hasConsent()) {
      try { localStorage.setItem(LS_KEY, `${bakuTodayStr()}|${clamped}`); } catch { /* ignore */ }
    }
  };

  return (
    <div className="card water-card">
      <div className="card-top">
        <span className="chip-ico tinted"><CupSoda size={20} aria-hidden /></span>
        <span className="eyebrow">{t("waterEyebrow")}</span>
      </div>
      <div className="water-row" role="group" aria-label={t("waterEyebrow")}>
        {Array.from({ length: 8 }, (_, i) => (
          <button
            key={i}
            type="button"
            className="water-glass"
            aria-pressed={i < count}
            aria-label={`${t("waterGlass")} ${i + 1}`}
            onClick={() => set(i < count ? i : i + 1)}
          >
            <CupSoda size={20} aria-hidden />
          </button>
        ))}
      </div>
      <p className="mood-state" style={{ color: "var(--muted)" }}>
        {count >= 8 ? t("waterDone") : `${count}/8`}
      </p>
      <p className="gplan-hint">{t("waterHint")}</p>
    </div>
  );
}
