"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { LoaderCircle } from "lucide-react";
import { apiUrl } from "@/lib/api-url";

/**
 * The administrator's console (v5.4 role system): a read-only platform
 * overview — open sessions, the appointment funnel, content counts and
 * user activity. Loads GET /api/admin/console on mount; the numbers are
 * counts computed by the backend (never raw rows).
 */

type AdminStats = {
  sessions: number;
  appointments: { requested: number; confirmed: number; upcoming: number; cancelled: number };
  psychologists: number;
  halls: number;
  visibleHalls: number;
  trainers: number;
  customPackages: number;
  journalEntries: number;
  moodLogs: number;
};

export function AdminPanel() {
  const t = useTranslations("adminApp");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");

  const load = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/api/admin/console"), { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      setStats((await res.json()).stats as AdminStats);
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stat = (value: number | undefined, label: string) => (
    <div>
      <b>{value ?? "—"}</b>
      <span>{label}</span>
    </div>
  );

  return (
    <div className="wrap">
      <header className="page-head">
        <h1 className="display sm">{t("title")}</h1>
        <p className="lede">{t("subtitle")}</p>
      </header>

      {state === "loading" && (
        <p className="lede" style={{ display: "flex", alignItems: "center", gap: ".55rem" }} aria-busy="true">
          <LoaderCircle size={18} className="spin" aria-hidden />
          {t("loading")}
        </p>
      )}

      {state === "error" && (
        <div className="psy-filters">
          <p className="field-error" style={{ margin: 0 }}>{t("errorGeneric")}</p>
          <div className="psy-filter-row">
            <button type="button" className="btn btn-sm" onClick={() => void load()}>
              <LoaderCircle size={14} aria-hidden />
              {t("retry")}
            </button>
          </div>
        </div>
      )}

      {state === "ready" && stats && (
        <>
          <section aria-labelledby="admin-overview" className="blk">
            <h2 id="admin-overview" className="eyebrow"><b>01</b>{t("statsTitle")}</h2>
            <div className="stats" aria-label={t("statsTitle")}>
              {stat(stats.sessions, t("sessionsTitle"))}
              {stat(stats.customPackages, t("packagesTitle"))}
              {stat(stats.journalEntries, t("journalsTitle"))}
              {stat(stats.moodLogs, t("moodTitle"))}
            </div>
            <p className="set-note">
              {t("sessionsDesc")}
            </p>
          </section>

          <section aria-labelledby="admin-appts" className="blk">
            <h2 id="admin-appts" className="eyebrow"><b>02</b>{t("appointmentsTitle")}</h2>
            <div className="stats" aria-label={t("appointmentsTitle")}>
              {stat(stats.appointments.requested, t("appt_requested"))}
              {stat(stats.appointments.confirmed, t("appt_confirmed"))}
              {stat(stats.appointments.upcoming, t("appt_upcoming"))}
              {stat(stats.appointments.cancelled, t("appt_cancelled"))}
            </div>
          </section>

          <section aria-labelledby="admin-content" className="blk">
            <h2 id="admin-content" className="eyebrow"><b>03</b>{t("contentTitle")}</h2>
            <div className="stats" aria-label={t("contentTitle")}>
              {stat(stats.psychologists, t("psychologists"))}
              {stat(stats.halls, t("halls"))}
              {stat(stats.visibleHalls, t("visibleHalls"))}
              {stat(stats.trainers, t("trainers"))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
