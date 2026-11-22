"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarDays, Check, LoaderCircle, X } from "lucide-react";
import { apiUrl } from "@/lib/api-url";
import { toast } from "@/components/Toaster";
import { ConfirmDialog } from "@/components/ConfirmDialog";

/**
 * The psychologist's console (v3.4 request workflow): pending session
 * requests to confirm or decline, then the confirmed (payment due) and
 * upcoming (paid) queues. Loads GET /api/psych/console on mount; answers
 * POST /api/psych/console { id, action } and refetches.
 *
 * The console copy arrives PRE-RESOLVED from the server page: the
 * psychApp.console.* keys ship in messages/*.json under a literal flat
 * "psychApp.console" key (and reach the DB catalog as dotted rows), which
 * next-intl cannot traverse as a namespace — the page resolves the tree
 * (nested-then-flat) and hands the strings over as a plain object.
 */
export type ConsoleCopy = {
  title: string;
  subtitle: string;
  pendingTitle: string;
  empty: string;
  client: string;
  wants: string;
  when: string;
  mode: string;
  confirm: string;
  decline: string;
  declineConfirm: string;
  confirmedTitle: string;
  confirmedEmpty: string;
  custom: string;
  noAccess: string;
};

type Entry = {
  id: string;
  psychologistSlug: string;
  startAt: string;
  mode: string;
  price: number | null;
  status: string;
  payment: string;
  createdAt: string;
  message: string | null;
  respondedAt: string | null;
  /** True when the slot sits outside the weekly blocks (custom-time ask). */
  custom: boolean;
  client: { name: string | null; email: string | null };
};

type ConsoleData = {
  slug: string;
  pending: Entry[];
  confirmed: Entry[];
  upcoming: Entry[];
};

export function ConsolePanel({ locale, copy }: { locale: string; copy: ConsoleCopy }) {
  const t = useTranslations("psychApp");
  const [data, setData] = useState<ConsoleData | null>(null);
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [busy, setBusy] = useState<string | null>(null);
  // The pending DECLINE confirm — declining a client's request is the
  // console's one destructive action, so it asks first (confirm declines).
  const [askDecline, setAskDecline] = useState<string | null>(null);

  // Same Baku wall-clock format the bookings page renders.
  const fmt = new Intl.DateTimeFormat(locale, {
    weekday: "short", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Baku",
  });

  const load = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/api/psych/console"));
      if (!res.ok) throw new Error(String(res.status));
      setData((await res.json()) as ConsoleData);
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const respond = async (id: string, action: "confirm" | "decline") => {
    if (busy) return;
    // Optimistic: the row leaves the pending queue immediately; the
    // refetch below reconciles it into confirmed/cancelled.
    setData((d) => (d ? { ...d, pending: d.pending.filter((e) => e.id !== id) } : d));
    setBusy(id);
    try {
      const res = await fetch(apiUrl("/api/psych/console"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      if (!res.ok) throw new Error(String(res.status));
      await load();
    } catch {
      toast(t("errorGeneric"), "error");
      await load();
    } finally {
      setBusy(null);
    }
  };

  const card = (e: Entry, actions: boolean) => (
    <li key={e.id} className="jrnl-entry">
      <div className="row">
        <span className="chip-ico tinted"><CalendarDays size={18} aria-hidden /></span>
        <span className="tag" style={{ border: 0, padding: 0, textTransform: "uppercase", letterSpacing: ".08em" }}>
          {copy.client}
        </span>
        <b>{e.client.name ?? "—"}</b>
        {e.client.email && (
          <span style={{ fontSize: ".8125rem", color: "var(--muted)", overflowWrap: "anywhere" }}>
            {e.client.email}
          </span>
        )}
        {e.custom && <span className="paytag">{copy.custom}</span>}
      </div>
      <div className="row" style={{ flexWrap: "wrap" }}>
        <span className="tag">{copy.when}: {fmt.format(new Date(e.startAt))}</span>
        <span className="tag">{copy.mode}: {t(`format_${e.mode}`)}</span>
        <span className="tag">{e.price ?? "—"} AZN</span>
        {actions && e.payment === "unpaid" && (
          <span className="paytag">{t("payUnpaid")}</span>
        )}
        {!actions && e.status === "upcoming" && (
          <span className="paytag" data-pay={e.payment}>
            {t(e.payment === "paid" ? "payPaid" : "payUnpaid")}
          </span>
        )}
      </div>
      {e.message && (
        <p className="quote-mini">
          <span style={{ color: "var(--muted)" }}>{copy.wants}: </span>
          {e.message}
        </p>
      )}
      {actions && (
        <div className="psy-actions" style={{ marginTop: 0 }}>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => void respond(e.id, "confirm")}
            disabled={busy !== null}
          >
            {busy === e.id ? <LoaderCircle size={14} className="spin" aria-hidden /> : <Check size={14} aria-hidden />}
            {copy.confirm}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={() => setAskDecline(e.id)}
            disabled={busy !== null}
          >
            {busy === e.id ? <LoaderCircle size={14} className="spin" aria-hidden /> : <X size={14} aria-hidden />}
            {copy.decline}
          </button>
        </div>
      )}
    </li>
  );

  return (
    <div className="wrap">
      <header className="page-head">
        <h1 className="display sm">{copy.title}</h1>
        <p className="lede">{copy.subtitle}</p>
      </header>

      {state === "loading" && (
        <p className="lede" style={{ display: "flex", alignItems: "center", gap: ".55rem" }} aria-busy="true">
          <LoaderCircle size={18} className="spin" aria-hidden />
          {copy.title}
        </p>
      )}

      {state === "error" && (
        <div className="psy-filters">
          <p className="field-error" style={{ margin: 0 }}>{t("errorGeneric")}</p>
          <div className="psy-filter-row">
            <button type="button" className="btn btn-sm" onClick={() => void load()}>
              <LoaderCircle size={14} aria-hidden />
              {t("quizAgain")}
            </button>
          </div>
        </div>
      )}

      {state === "ready" && data && (
        <>
          <section aria-labelledby="con-pending" className="blk">
            <h2 id="con-pending" className="eyebrow"><b>01</b>{copy.pendingTitle}</h2>
            {data.pending.length === 0 ? (
              <p className="lede">{copy.empty}</p>
            ) : (
              <ul className="jrnl">
                {data.pending.map((e) => card(e, true))}
              </ul>
            )}
          </section>

          <section aria-labelledby="con-confirmed" className="blk">
            <h2 id="con-confirmed" className="eyebrow"><b>02</b>{copy.confirmedTitle}</h2>
            {data.confirmed.length === 0 ? (
              <p className="lede">{copy.confirmedEmpty}</p>
            ) : (
              <ul className="jrnl">
                {data.confirmed.map((e) => card(e, false))}
              </ul>
            )}
          </section>

          <section aria-labelledby="con-upcoming" className="blk">
            <h2 id="con-upcoming" className="eyebrow"><b>03</b>{t("bookingsUpcoming")}</h2>
            {data.upcoming.length === 0 ? (
              <p className="lede">{t("bookingsEmptyUpcoming")}</p>
            ) : (
              <ul className="jrnl">
                {data.upcoming.map((e) => card(e, false))}
              </ul>
            )}
          </section>
        </>
      )}

      <ConfirmDialog
        open={askDecline !== null}
        onClose={() => setAskDecline(null)}
        onConfirm={() => {
          const id = askDecline;
          setAskDecline(null);
          if (id) void respond(id, "decline");
        }}
        message={copy.declineConfirm}
        confirmLabel={copy.decline}
        busy={busy !== null}
      />
    </div>
  );
}
