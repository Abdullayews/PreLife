"use client";

import { useTranslations } from "next-intl";
import {
  useCallback, useEffect, useMemo, useRef, useState,
  useSyncExternalStore,
  type CSSProperties, type ReactNode,
} from "react";
import {
  BookOpen, Brain, CalendarDays, ChevronsUpDown, Clock, Crown,
  Dumbbell, House, LoaderCircle, MapPin, Moon, Pill, Play, Salad, Search,
  SearchX, Settings, Shirt, Star, Sun, Wand2, X,
  type LucideIcon,
} from "lucide-react";
import {
  GROUP_ORDER, IDMAN_TABS, QUIZ_STEPS, exerciseVideo, groupOf,
  isIdmanTabId, minutesOf, muscleGroupsOf, productVideo, totalSetsOf,
  type ActivePlan, type IdmanTabId, type PlanDay, type PlanExercise,
  type QuizAnswers, type QuizStep,
} from "./data";
import {
  minPriceOf,
  type GymAppContent, type GymAppExercise, type GymAppPlace, type GymAppProduct,
} from "@/lib/gym";

/**
 * İdman v4 — the gym surface, fully DB-wired.
 *
 * Layout: a collapsible glass sidebar (the "menu" module) with the İdman
 * group (plan · qida əlavələri · aksesuarlar · zallar · alətlər) plus the
 * other PreLife sections, and a main column that hosts one of five panels:
 *
 *  • plan — the ACTIVE plan (GET /api/gym/plan): a hero with the week
 *    progress and the "Şəxsi plan qur" questionnaire, today's session as
 *    a STICKY summary panel (muscle groups, exercise list with sets ×
 *    reps) beside the day's exercise cards (a real demo video for
 *    registry moves, a placeholder for custom AI moves, the how-to guide
 *    and a completion toggle each), the weekly strip and the plan catalog
 *    (from the gym_* content tables).
 *  • supplements / accessories / equipment — search + filter-chip + sort
 *    catalogs on a 4-column grid (equipment carries a real video per item).
 *  • gyms — hall cards: info & location on top, trainers below, then the
 *    hall's equipment floor.
 *
 * Every piece of content renders from the `catalog` prop (server-resolved,
 * locale-final — lib/api.ts getGymAppContent) and every UI string comes
 * from the gymApp message namespace; nothing is hardcoded per locale.
 */

/* ── Props ──────────────────────────────────────────────────────────────── */

export type IdmanLinks = {
  home?: string; diet?: string; meditation?: string; library?: string; settings?: string;
};

export type IdmanAppProps = {
  user: { name: string; email?: string | null };
  /** The server-resolved gym catalog (plain text, final locale). */
  catalog: GymAppContent;
  initialTab?: IdmanTabId;
  /** Route hrefs for the non-gym sections (defaults to "#"). */
  links?: IdmanLinks;
  /** PreLife: persists the choice (consent + profile). Falls back to the
   *  plain html.dark toggle when omitted. */
  onThemeChange?: (dark: boolean) => void;
  /** EMBEDDED mode (PreLife /gym): the global AppShell provides the left
   *  rail, so this component renders only the main column. */
  embedded?: boolean;
  /** Controlled tab (embedded mode) — the rail's subtab group drives it. */
  tab?: IdmanTabId;
  onTabChange?: (tab: IdmanTabId) => void;
};

/* ── Consent-gated storage (PreLife semantics, dependency-free) ─────────── */

const canStore = () => {
  if (typeof document === "undefined") return false;
  return document.cookie
    .split(";")
    .some((c) => c.trim().startsWith("pl_cookies="));
};

const storeGet = (key: string): string | null => {
  if (!canStore()) return null;
  try { return localStorage.getItem(key); } catch { return null; }
};
const storeSet = (key: string, value: string): void => {
  if (!canStore()) return;
  try { localStorage.setItem(key, value); } catch { /* unavailable */ }
};

/** Today as YYYY-MM-DD in Baku time (like the old gym v1.2 check-in). */
const bakuToday = (): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Baku" }).format(new Date());

/** Localized weekday name for the plan's 1..7 (1 = Monday): 2024-01-01
 *  was a Monday, so Jan <planDay> is exactly that weekday. */
const weekdayLabel = (locale: string, planDay: number, short: boolean): string => {
  const d = new Date(2024, 0, Math.min(7, Math.max(1, planDay)));
  return new Intl.DateTimeFormat(locale, { weekday: short ? "short" : "long" }).format(d);
};

/* ── Video tile — real footage, hover/tap to play ───────────────────────── */

function VideoTile({ src, label, tall }: { src: string; label: string; tall?: boolean }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);

  const start = useCallback(() => {
    const v = ref.current;
    if (!v) return;
    v.play().then(() => setPlaying(true)).catch(() => { /* autoplay blocked */ });
  }, []);
  const stop = useCallback(() => {
    const v = ref.current;
    if (!v) return;
    v.pause();
    setPlaying(false);
  }, []);

  return (
    <div
      className={`ivideo${tall ? " tall" : ""}`}
      onMouseEnter={start}
      onMouseLeave={stop}
      onFocus={start}
      onBlur={stop}
    >
      <video
        ref={ref}
        src={src}
        muted loop playsInline preload="metadata"
        aria-label={label}
        onClick={() => (playing ? stop() : start())}
      />
      <span className="ivideo-play" aria-hidden style={{ opacity: playing ? 0 : 1 }}>
        <Play size={16} strokeWidth={2.4} />
      </span>
    </div>
  );
}

/* ── Sidebar item helpers ───────────────────────────────────────────────── */

function NavRow({
  icon: Icon, label, hint, open, active, onClick, href,
}: {
  icon: LucideIcon; label: string; hint?: string; open: boolean;
  active?: boolean; onClick?: () => void; href?: string;
}) {
  const cls = `inav-row${active ? " active" : ""}`;
  const inner = (
    <>
      <span className="inav-ic" aria-hidden><Icon size={19} strokeWidth={2} /></span>
      {open && (
        <span className="inav-row-txt">
          <span className="inav-row-label">{label}</span>
          {hint && <span className="inav-row-hint">{hint}</span>}
        </span>
      )}
    </>
  );
  return href !== undefined ? (
    <a className={cls} href={href} aria-current={active ? "page" : undefined} title={!open ? label : undefined}>
      {inner}
    </a>
  ) : (
    <button type="button" className={cls} onClick={onClick} aria-current={active ? "page" : undefined} title={!open ? label : undefined}>
      {inner}
    </button>
  );
}

/* ── Panel: plan ────────────────────────────────────────────────────────── */

/** JS getDay() (0 = Sunday) → the plan's 1..7 (1 = Monday, 7 = Sunday). */
const planDayOf = (jsDay: number): number => (jsDay === 0 ? 7 : jsDay);

type PlanStatus = "loading" | "quiz" | "ready" | "error";

function PlanPanel({ catalog }: { catalog: GymAppContent }) {
  const t = useTranslations("gymApp");
  const [plan, setPlan] = useState<ActivePlan | null>(null);
  const [status, setStatus] = useState<PlanStatus>("loading");
  const [busy, setBusy] = useState(false);
  const [offlineNote, setOfflineNote] = useState(false);
  const planRef = useRef<ActivePlan | null>(null);

  /* Load the active plan — the server lazily creates the starter plan and
   * tells whether the questionnaire was already completed. When the API is
   * unreachable the panel shows its unavailable state + a retry. */
  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const res = await fetch(`/api/gym/plan?locale=${encodeURIComponent(catalog.locale)}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { plan: ActivePlan | null; onboardingDone: boolean };
      planRef.current = data.plan;
      setPlan(data.plan);
      setStatus(data.onboardingDone || data.plan ? "ready" : "quiz");
    } catch {
      setStatus("error");
    }
  }, [catalog.locale]);

  useEffect(() => { void load(); }, [load]);

  /* The questionnaire's answers → a personal plan (AI, rules fallback). */
  const build = useCallback(async (answers: QuizAnswers) => {
    setBusy(true);
    try {
      const res = await fetch("/api/gym/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: catalog.locale, answers }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { plan: ActivePlan | null };
      if (!data.plan) throw new Error("no plan");
      planRef.current = data.plan;
      setPlan(data.plan);
      setOfflineNote(false);
      setStatus("ready");
    } catch {
      /* offline — keep showing the current plan + a small note */
      setOfflineNote(true);
      setStatus(planRef.current ? "ready" : "error");
    } finally {
      setBusy(false);
    }
  }, [catalog.locale]);

  /* Sıfırla — deactivate the plan; the reload recreates the starter plan
   * and the questionnaire becomes available again. */
  const reset = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/gym/plan", { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await load();
    } catch {
      /* offline — nothing to reset */
    } finally {
      setBusy(false);
    }
  }, [load]);

  if (status === "loading") {
    return (
      <div className="iplan" aria-busy="true">
        <p className="iplan-rest">{t("plan.loading")}</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="iplan" role="status">
        <p className="iplan-rest">{t("plan.planUnavailable")}</p>
        <div>
          <button type="button" className="ibtn ibtn-sm" onClick={() => { void load(); }}>
            {t("plan.retry")}
          </button>
        </div>
      </div>
    );
  }

  if (status === "quiz" || !plan) {
    return (
      <PlanQuiz
        busy={busy}
        onCancel={() => setStatus(planRef.current ? "ready" : "error")}
        onSubmit={build}
      />
    );
  }

  return (
    <PlanView
      plan={plan}
      catalog={catalog}
      busy={busy}
      note={offlineNote}
      onBuild={() => { setOfflineNote(false); setStatus("quiz"); }}
      onReset={reset}
    />
  );
}

/* ── The active plan view (hero + today's session + weekly strip) ───────── */

function PlanView({
  plan, catalog, busy, note, onBuild, onReset,
}: {
  plan: ActivePlan;
  catalog: GymAppContent;
  busy: boolean;
  /** the last personal-plan POST failed — show the offline note. */
  note: boolean;
  onBuild: () => void;
  onReset: () => void;
}) {
  const t = useTranslations("gymApp");
  const [weekday, setWeekday] = useState<number | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const doneKey = useRef<string>("");

  /* "Today" once, client-side (Baku), deferred a frame so the first
   * paint stays hydration-safe (the server cannot know the date). */
  useEffect(() => {
    const id = requestAnimationFrame(() => setWeekday(new Date().getDay()));
    return () => cancelAnimationFrame(id);
  }, []);

  /* Today's session over the plan's days — or, on a rest day, the next
   * session cyclically (Sunday wraps to Monday). */
  const isToday = useMemo(
    () => weekday !== null && plan.days.some((d) => d.day === planDayOf(weekday)),
    [plan.days, weekday],
  );
  const day = useMemo<PlanDay>(() => {
    const start = planDayOf(weekday ?? 1);
    for (let i = 0; i < 7; i++) {
      const hit = plan.days.find((d) => d.day === ((start - 1 + i) % 7) + 1);
      if (hit) return hit;
    }
    return plan.days[0] ?? { day: 1, focus: "", exercises: [] };
  }, [plan.days, weekday]);

  /* Completion state — per plan + day + date, consent-gated, read a
   * frame after mount (storage is browser-only). Keyed by exercise INDEX:
   * custom AI moves share ex === "". */
  useEffect(() => {
    const key = `pl:idman:done:${plan.id}:${day.day}:${bakuToday()}`;
    const id = requestAnimationFrame(() => {
      doneKey.current = key;
      const raw = storeGet(key);
      setDone(new Set(raw ? (JSON.parse(raw) as string[]).filter(Boolean) : []));
    });
    return () => cancelAnimationFrame(id);
  }, [plan.id, day.day]);

  const toggleDone = (idx: string) => {
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      storeSet(doneKey.current, JSON.stringify([...next]));
      return next;
    });
  };

  const total = day.exercises.length;
  const doneCount = day.exercises.filter((_, i) => done.has(String(i))).length;
  const allDone = total > 0 && doneCount === total;
  const groups = muscleGroupsOf(day, catalog.exercises);
  const minutes = minutesOf(day);
  const sets = totalSetsOf(day);
  const weekPct = Math.max(0, Math.min(100, Math.round((plan.week / Math.max(1, plan.total)) * 100)));
  const dayName = weekdayLabel(catalog.locale, day.day, false);

  return (
    <div className="iplan">
      {/* Active plan header */}
      <div className="iplan-hero" style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
        <div className="iplan-hero-body">
          <p className="iplan-eyebrow"><span className="iplan-eyebrow-i" aria-hidden />{t("plan.activeEyebrow")}</p>
          <h2 className="iplan-hero-title">{plan.title}</h2>
          {plan.focus && <p className="iplan-hero-desc">{plan.focus}</p>}
          <div className="iplan-hero-meta">
            {plan.level && <span className="itag itag-solid">{plan.level}</span>}
            <span className="itag">{plan.source === "ai" ? t("plan.aiTag") : t("plan.defaultTag")}</span>
            <span className="itag">{t("plan.weekLabel", { week: plan.week, total: plan.total })}</span>
            <span className="itag">{t("plan.daysPerWeek", { count: plan.days.length })}</span>
          </div>
          <div
            className="iplan-bar"
            role="progressbar"
            aria-valuenow={weekPct}
            aria-valuemin={0} aria-valuemax={100}
            aria-label={t("plan.progressA11y", { percent: weekPct })}
          >
            <i style={{ width: `${weekPct}%` }} />
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: ".5rem", marginTop: ".2rem" }}>
            <button type="button" className="ibtn ibtn-sm" onClick={onBuild} disabled={busy}>
              <Wand2 size={15} aria-hidden />{t("plan.buildCta")}
            </button>
            <button type="button" className="ibtn ibtn-sm ibtn-ghost" onClick={onReset} disabled={busy}>
              {t("plan.resetCta")}
            </button>
          </div>
          {note && <p className="iplan-rest">{t("plan.offlineNote")}</p>}
        </div>
      </div>

      {/* Today's session: sticky summary + exercise cards */}
      <div className="iplan-grid">
        <aside className="iplan-side" aria-label={t("plan.sessionSummary")}>
          <div className="iplan-side-card">
            <p className="iplan-side-day">
              {isToday ? t("plan.sessionTitle") : t("plan.nextSession")}
            </p>
            <p className="iplan-side-date">{dayName}</p>
            {day.focus && (
              <p style={{ margin: 0, fontSize: ".8rem", fontWeight: 600, color: "var(--muted)" }}>
                {day.focus}
              </p>
            )}

            {!isToday && <p className="iplan-rest">{t("plan.restDay")}</p>}

            <div className="iplan-stats">
              <div><b>{total}</b><span>{t("plan.statExercises")}</span></div>
              <div><b>{sets}</b><span>{t("plan.statSets")}</span></div>
              <div><b>~{minutes}</b><span>{t("plan.statMinutes")}</span></div>
            </div>

            <p className="iplan-side-sub">{t("plan.muscleGroups")}</p>
            <ul className="iplan-chips">
              {groups.map((g) => <li key={g} className="itag">{g}</li>)}
            </ul>

            <ol className="iplan-list">
              {day.exercises.map((pe, i) => (
                <li key={i} className={done.has(String(i)) ? "done" : undefined}>
                  <span className="iplan-list-n" aria-hidden>{i + 1}</span>
                  <span className="iplan-list-name">{pe.name}</span>
                  <span className="iplan-list-dose">{t("plan.setsLine", { sets: pe.sets, reps: pe.reps })}</span>
                </li>
              ))}
            </ol>

            <div className="iplan-progress">
              <div className="iplan-bar small" aria-hidden>
                <i style={{ width: `${total ? Math.round((doneCount / total) * 100) : 0}%` }} />
              </div>
              <p className="iplan-progress-txt">{t("plan.sessionProgress", { done: doneCount, total })}</p>
              {allDone && <p className="iplan-finished">{t("plan.finished")}</p>}
            </div>
          </div>
        </aside>

        <div className="iplan-cards">
          {!isToday && (
            <p className="iplan-next-hint">
              {t("plan.restDay")} — {t("plan.nextSession")}: <b>{dayName}</b>
            </p>
          )}
          <ul className="iex-grid">
            {day.exercises.map((pe, i) => (
              <ExerciseCard
                key={i}
                index={i}
                pe={pe}
                ex={catalog.exercises[pe.ex]}
                done={done.has(String(i))}
                onToggle={() => toggleDone(String(i))}
              />
            ))}
          </ul>
        </div>
      </div>

      {/* Weekly strip */}
      <section className="iplan-week" aria-label={t("plan.scheduleA11y")}>
        <p className="iplan-side-sub">{t("plan.scheduleEyebrow")}</p>
        <ul className="iplan-week-row">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => {
            const has = plan.days.some((pd) => pd.day === planDayOf(d));
            const isTodayRow = weekday === d;
            return (
              <li
                key={d}
                className={[
                  "iplan-week-day",
                  has ? "work" : "rest",
                  isTodayRow ? "today" : "",
                ].join(" ")}
                aria-current={isTodayRow ? "date" : undefined}
              >
                <span className="iplan-week-name">{weekdayLabel(catalog.locale, planDayOf(d), true)}</span>
                <span className="iplan-week-tag">{has ? t("plan.workoutTag") : t("plan.restTag")}</span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* The plan catalog (gym_* content tables) */}
      {catalog.plans.length > 0 && (
        <section className="iplan-plans" aria-label={t("plan.plansEyebrow")}>
          <p className="iplan-side-sub">{t("plan.plansEyebrow")}</p>
          <ul className="iplan-plan-grid">
            {catalog.plans.map((p, i) => (
              <PlanCard key={p.id} plan={p} i={i} locale={catalog.locale} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/* ── A plan-catalog card: image, meta, progress + expandable day details ── */

function PlanCard({
  plan, i, locale,
}: {
  plan: GymAppContent["plans"][number];
  i: number;
  locale: string;
}) {
  const t = useTranslations("gymApp");
  const [open, setOpen] = useState(false);
  const pct = plan.week !== null && plan.total
    ? Math.max(0, Math.min(100, Math.round((plan.week / plan.total) * 100)))
    : null;
  return (
    <li className="iplan-plan" style={{ "--i": i } as CSSProperties}>
      <img src={plan.image} alt="" width={640} height={360} loading="lazy" decoding="async" />
      <div className="iplan-plan-body">
        <div className="iplan-plan-top">
          <h3>{plan.name}</h3>
          {plan.level && <span className="itag">{plan.level}</span>}
        </div>
        <p>{plan.desc}</p>
        <div className="iplan-hero-meta" style={{ marginTop: ".1rem" }}>
          {plan.meta.map((m, mi) => <span key={mi} className="itag">{m}</span>)}
          {pct !== null && (
            <span className="itag itag-solid">
              {plan.week}/{plan.total}
            </span>
          )}
        </div>
        {pct !== null && (
          <div className="iplan-bar small" aria-hidden>
            <i style={{ width: `${pct}%` }} />
          </div>
        )}
        <button
          type="button"
          className="ibtn ibtn-sm ibtn-ghost"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <ChevronsUpDown
            size={14} aria-hidden
            style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .25s var(--ease-out, cubic-bezier(.23,1,.32,1))" }}
          />
          {t("plan.daysToggle", { count: plan.days.length })}
        </button>
        {open && (
          <div className="iplan-plan-days">
            {plan.days.map((d) => (
              <div key={d.day} className="iplan-plan-day">
                <h5>{weekdayLabel(locale, d.day, false)}</h5>
                <ul>
                  {d.exercises.map((pe, ei) => (
                    <li key={ei}>
                      <span>{pe.name}</span>
                      <b>{pe.sets} × {pe.reps}</b>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

/* ── The personal-plan questionnaire (first entry + rebuild) ────────────── */

function PlanQuiz({
  busy, onCancel, onSubmit,
}: {
  busy: boolean;
  onCancel: () => void;
  onSubmit: (answers: QuizAnswers) => void;
}) {
  const t = useTranslations("gymApp");
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  /* one pick list per step (multi steps hold up to `cap` options) */
  const [picked, setPicked] = useState<string[][]>(() => QUIZ_STEPS.map(() => []));
  const [text, setText] = useState("");

  const s: QuizStep = QUIZ_STEPS[step] ?? QUIZ_STEPS[0]!;
  const last = step === QUIZ_STEPS.length - 1;
  const chosen = picked[step] ?? [];
  const canNext = s.kind === "free" || chosen.length > 0;
  const question = t(`quiz.q_${s.id}`);
  const options = useMemo(
    () => Array.from({ length: s.options }, (_, i) => t(`quiz.q_${s.id}_o${i + 1}`)),
    [s.id, s.options, t],
  );

  const pick = (option: string) => {
    setPicked((prev) => prev.map((sel, i) => {
      if (i !== step) return sel;
      const has = sel.includes(option);
      if (s.cap) {
        return has ? sel.filter((o) => o !== option)
          : sel.length >= s.cap ? sel : [...sel, option];
      }
      return has ? [] : [option];
    }));
  };

  const go = (next: number) => {
    setDir(next > step ? 1 : -1);
    setStep(next);
  };

  const next = () => {
    if (!canNext || busy) return;
    if (last) {
      onSubmit({
        goal: picked[0]?.[0] ?? "",
        experience: picked[1]?.[0] ?? "",
        days: picked[2]?.[0] ?? "",
        equipment: picked[3]?.[0] ?? "",
        focus: (picked[4] ?? []).join(", "),
        limitations: text.trim(),
      });
      return;
    }
    go(step + 1);
  };

  return (
    <div className="iplan">
      <div className="iplan-hero" style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
        <div className="iplan-hero-body">
          <p className="iplan-eyebrow"><span className="iplan-eyebrow-i" aria-hidden />{t("quiz.eyebrow")}</p>
          <h2 className="iplan-hero-title">{t("quiz.title")}</h2>
          <p className="iplan-hero-desc">{t("quiz.desc")}</p>

          {/* the step progress bar — linear width, advancing with steps */}
          <div
            className="iquiz-bar"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={QUIZ_STEPS.length}
            aria-valuenow={step + 1}
            aria-label={t("quiz.stepOf", { step: step + 1, total: QUIZ_STEPS.length })}
          >
            <i style={{ width: `${((step + 1) / QUIZ_STEPS.length) * 100}%` }} />
          </div>

          <div key={step} className={dir === 1 ? "iquiz-step iquiz-step-fwd" : "iquiz-step iquiz-step-back"}>
            <div className="iplan-hero-meta" style={{ marginTop: ".2rem" }}>
              <span className="itag itag-solid">
                {t("quiz.stepOf", { step: step + 1, total: QUIZ_STEPS.length })}
              </span>
            </div>

            <h3 style={{ margin: ".4rem 0 0", font: "600 1.15rem/1.3 var(--font-display)", letterSpacing: "-.01em" }}>
              {question}
            </h3>

            {s.kind === "free" ? (
              <>
                <textarea
                  value={text}
                  rows={3}
                  placeholder={t("quiz.limitPlaceholder")}
                  aria-label={question}
                  onChange={(e) => setText(e.target.value)}
                  disabled={busy}
                  style={{
                    width: "100%", padding: ".7rem .9rem",
                    border: "1px solid var(--line)", borderRadius: "14px",
                    background: "var(--surface)", color: "var(--ink)",
                    font: "500 .9rem/1.45 var(--font-body)", resize: "vertical",
                  }}
                />
                <ul className="ishop-chips">
                  <li>
                    <button
                      type="button"
                      className="ichip"
                      aria-pressed={text.trim() === ""}
                      onClick={() => setText("")}
                      disabled={busy}
                    >
                      {t("quiz.none")}
                    </button>
                  </li>
                </ul>
              </>
            ) : (
              <ul className="ishop-chips" aria-label={question}>
                {options.map((o) => (
                  <li key={o}>
                    <button
                      type="button"
                      className="ichip"
                      aria-pressed={chosen.includes(o)}
                      onClick={() => pick(o)}
                      disabled={busy}
                    >
                      {o}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: ".5rem", marginTop: ".3rem" }}>
            <button
              type="button"
              className="ibtn ibtn-ghost ibtn-sm"
              onClick={step === 0 ? onCancel : () => go(step - 1)}
              disabled={busy}
            >
              {t("quiz.back")}
            </button>
            <button type="button" className="ibtn ibtn-sm" onClick={next} disabled={!canNext || busy}>
              {busy
                ? <><LoaderCircle size={15} className="spin" aria-hidden />{t("quiz.busy")}</>
                : (last ? t("quiz.finish") : t("quiz.next"))}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── An exercise card of today's session ────────────────────────────────── */

function ExerciseCard({
  index, pe, ex, done, onToggle,
}: {
  index: number; pe: PlanExercise; ex: GymAppExercise | undefined;
  done: boolean; onToggle: () => void;
}) {
  const t = useTranslations("gymApp");
  const video = ex ? exerciseVideo(pe.ex) : null;
  const [open, setOpen] = useState(false);
  return (
    <li className={`iex${done ? " done" : ""}`}>
      <div
        className="iex-media"
        style={video ? undefined : {
          /* custom AI move — no video: a centered dumbbell placeholder */
          aspectRatio: "16 / 10", background: "var(--tint)",
          display: "grid", placeItems: "center",
        }}
      >
        {video
          ? <VideoTile src={video} label={`${pe.name} — demo`} tall />
          : <Dumbbell size={30} strokeWidth={1.5} aria-hidden style={{ color: "var(--muted)" }} />}
        <span className="iex-n" aria-hidden>{index + 1}</span>
      </div>
      <div className="iex-body">
        <div className="iex-top">
          <h3 className="iex-name">{pe.name}</h3>
          <span className="iex-dose">{t("plan.setsLine", { sets: pe.sets, reps: pe.reps })}</span>
        </div>
        {ex && <p className="iex-target">{ex.target}</p>}
        {pe.note && <p className="iex-rest" style={{ fontStyle: "italic" }}>{pe.note}</p>}
        <p className="iex-rest">
          <Clock size={14} aria-hidden />
          {pe.rest > 0 ? t("plan.restLine", { count: pe.rest }) : t("plan.flowLine")}
        </p>
        {ex && (
          <details className="iex-guide" open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
            <summary>{t("plan.howTo")}</summary>
            <p>{ex.guide}</p>
          </details>
        )}
        <button
          type="button"
          className={`ibtn iex-done${done ? " done" : ""}`}
          aria-pressed={done}
          title={done ? t("plan.doneUndo") : t("plan.done")}
          onClick={onToggle}
        >
          {done ? (
            <>
              <svg className="iex-check" viewBox="0 0 24 24" aria-hidden>
                <path d="M4.5 12.5l5 5 10-11" />
              </svg>
              {t("plan.done")}
            </>
          ) : t("plan.done")}
        </button>
      </div>
    </li>
  );
}

/* ── Panel: catalogs (supplements / accessories / equipment) ────────────── */

type ShopTab = "supplements" | "accessories" | "equipment";

function ShopPanel({ tab, catalog }: { tab: ShopTab; catalog: GymAppContent }) {
  const t = useTranslations("gymApp");
  const items = useMemo(
    () => catalog.products.filter((p) =>
      tab === "accessories" ? (p.cat === "accessories" || p.cat === "clothing") : p.cat === tab),
    [catalog.products, tab],
  );

  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<string>("all");
  const [sort, setSort] = useState<"popular" | "cheap">("popular");

  /* The filter chips — category labels for accessories, group labels for
   * the rest (both translated). */
  const groups = useMemo(() => (
    tab === "accessories"
      ? [{ id: "accessories", label: t("tab_accessories") }, { id: "clothing", label: t("tab_clothing") }]
      : GROUP_ORDER[tab].map((id) => ({ id: id as string, label: t(`group.${id}`) }))
  ), [tab, t]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = items.filter((p) => {
      const g = groupOf(p);
      const inGroup = tab === "accessories"
        ? group === "all" || p.cat === group
        : group === "all" || g === group;
      if (!inGroup) return false;
      if (!q) return true;
      const hay = [
        p.name, p.brand,
        ...p.offers.map((a) => a.storeName),
      ].join(" ").toLowerCase();
      return hay.includes(q);
    });
    if (sort === "cheap") list = [...list].sort((a, b) => minPriceOf(a.offers) - minPriceOf(b.offers));
    return list;
  }, [items, query, group, sort, tab]);

  return (
    <div className="ishop">
      <div className="ishop-bar">
        <div className="isearch">
          <Search size={16} aria-hidden />
          <input
            type="search"
            value={query}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchLabel")}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query !== "" && (
            <button type="button" className="isearch-x" aria-label={t("searchClear")} onClick={() => setQuery("")}>
              <X size={14} aria-hidden />
            </button>
          )}
        </div>
        <div className="iseg" role="group" aria-label={t("sortLabel")}>
          <button type="button" aria-pressed={sort === "popular"} onClick={() => setSort("popular")}>{t("sortPopular")}</button>
          <button type="button" aria-pressed={sort === "cheap"} onClick={() => setSort("cheap")}>{t("sortCheap")}</button>
        </div>
      </div>

      <ul className="ishop-chips" aria-label={t("filterLabel")}>
        <li>
          <button type="button" className="ichip" aria-pressed={group === "all"} onClick={() => setGroup("all")}>
            {t("filterAll")}
          </button>
        </li>
        {groups.map((g) => (
          <li key={g.id}>
            <button type="button" className="ichip" aria-pressed={group === g.id} onClick={() => setGroup(g.id)}>
              {g.label}
            </button>
          </li>
        ))}
      </ul>

      <output className="sr-only" aria-live="polite">
        {t("resultsA11y", { shown: shown.length, total: items.length })}
      </output>

      <p className="ishop-note">{t("shopNote")}</p>

      {shown.length === 0 ? (
        <div className="iempty">
          <SearchX size={22} aria-hidden />
          <p><b>{t("noResults")}</b></p>
          <button type="button" className="ibtn ibtn-sm ibtn-ghost" onClick={() => { setQuery(""); setGroup("all"); }}>
            {t("filterAll")}
          </button>
        </div>
      ) : (
        <ul className="ishop-grid" key={`${group}|${sort}|${query}`}>
          {shown.map((p, i) => <ProductCard key={p.id} p={p} i={i} />)}
        </ul>
      )}
    </div>
  );
}

function ProductCard({ p, i }: { p: GymAppProduct; i: number }) {
  const t = useTranslations("gymApp");
  const video = productVideo(p.id);
  const cheapest = minPriceOf(p.offers);
  const best = p.offers.findIndex((a) => a.price === cheapest);
  return (
    <li className="iprod" style={{ "--i": i } as CSSProperties}>
      {video ? (
        <VideoTile src={video} label={`${p.name} — demo`} />
      ) : (
        <div className="iprod-img">
          <img src={p.image} alt="" width={480} height={360} loading="lazy" decoding="async" />
        </div>
      )}
      <div className="iprod-body">
        <p className="iprod-brand">{p.brand}</p>
        <h3 className="iprod-name">{p.name}</h3>
        <p className="iprod-price">{p.price[0]}–{p.price[1]} ₼</p>
        <div className="iprod-offers">
          <p className="iprod-offers-t">{t("atCount", { count: p.offers.length })}</p>
          {p.offers.map((a, idx) => (
            <a
              key={a.store}
              className={`iprod-offer${idx === best ? " best" : ""}`}
              href={a.url}
              target="_blank"
              rel="noreferrer noopener"
            >
              <span className="iprod-offer-name">{a.storeName}</span>
              <span className="iprod-offer-kind">{a.kindLabel}</span>
              <span className="iprod-offer-price">{a.price} ₼</span>
              {idx === best && <span className="itag itag-solid">{t("bestPrice")}</span>}
            </a>
          ))}
        </div>
      </div>
    </li>
  );
}

/* ── Panel: halls (zallar) ──────────────────────────────────────────────── */

function HallsPanel({ catalog }: { catalog: GymAppContent }) {
  const t = useTranslations("gymApp");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"rating" | "price">("rating");
  const [active, setActive] = useState<string[]>([]);

  const halls = catalog.halls;

  /* The amenity chips — the resolved labels, in first-seen order. */
  const features = useMemo(() => {
    const set = new Set<string>();
    for (const h of halls) for (const f of h.features) set.add(f);
    return [...set];
  }, [halls]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = halls.filter((h) => {
      if (active.length > 0 && !active.some((f) => h.features.includes(f))) return false;
      if (!q) return true;
      return `${h.name} ${h.desc} ${h.address}`.toLowerCase().includes(q);
    });
    list = [...list].sort((a, b) =>
      sort === "rating"
        ? (b.rating ?? 0) - (a.rating ?? 0)
        : (a.dayPrice ?? 0) - (b.dayPrice ?? 0));
    return list;
  }, [halls, query, sort, active]);

  const toggle = (f: string) =>
    setActive((prev) => prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]);

  return (
    <div className="izal">
      <div className="ishop-bar">
        <div className="isearch">
          <Search size={16} aria-hidden />
          <input
            type="search"
            value={query}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchLabel")}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query !== "" && (
            <button type="button" className="isearch-x" aria-label={t("searchClear")} onClick={() => setQuery("")}>
              <X size={14} aria-hidden />
            </button>
          )}
        </div>
        <div className="iseg" role="group" aria-label={t("sortLabel")}>
          <button type="button" aria-pressed={sort === "rating"} onClick={() => setSort("rating")}>{t("gyms.sortRating")}</button>
          <button type="button" aria-pressed={sort === "price"} onClick={() => setSort("price")}>{t("gyms.sortPrice")}</button>
        </div>
      </div>

      <ul className="ishop-chips" aria-label={t("gyms.filterLabel")}>
        <li>
          <button type="button" className="ichip" aria-pressed={active.length === 0} onClick={() => setActive([])}>
            {t("gyms.filterAll")}
          </button>
        </li>
        {features.map((f) => (
          <li key={f}>
            <button type="button" className="ichip" aria-pressed={active.includes(f)} onClick={() => toggle(f)}>
              {f}
            </button>
          </li>
        ))}
      </ul>

      <output className="sr-only" aria-live="polite">
        {t("resultsA11y", { shown: shown.length, total: halls.length })}
      </output>

      {shown.length === 0 ? (
        <div className="iempty">
          <SearchX size={22} aria-hidden />
          <p><b>{t("gyms.gymsNoResults")}</b></p>
          <button type="button" className="ibtn ibtn-sm ibtn-ghost" onClick={() => { setQuery(""); setActive([]); }}>
            {t("gyms.filterAll")}
          </button>
        </div>
      ) : (
        <ul className="izal-grid" key={`${sort}|${active.join("|")}`}>
          {shown.map((h, i) => <HallCard key={h.id} h={h} i={i} />)}
        </ul>
      )}
    </div>
  );
}

function HallCard({ h, i }: { h: GymAppPlace; i: number }) {
  const t = useTranslations("gymApp");
  const [eqOpen, setEqOpen] = useState(false);
  const eqShown = eqOpen ? h.equipment : h.equipment.slice(0, 8);
  const more = h.equipment.length - eqShown.length;
  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`Baku ${h.name} ${h.address}`)}`;
  return (
    <li className="izal-card" style={{ "--i": i } as CSSProperties}>
      <div className="izal-img">
        <img src={h.image} alt="" width={800} height={533} loading="lazy" decoding="async" />
        {h.rating !== null && (
          <span className="izal-score" role="img" aria-label={t("ratingA11y", { score: h.rating.toFixed(1) })}>
            <Star size={14} fill="currentColor" aria-hidden />{h.rating.toFixed(1)}
          </span>
        )}
      </div>
      <div className="izal-body">
        <h3 className="izal-name">{h.name}</h3>
        <p className="izal-desc">{h.desc}</p>
        <div className="izal-meta">
          <span><MapPin size={15} aria-hidden />{h.address}</span>
          <span>
            <span className="sr-only">{t("gyms.openHoursSr")}: </span>
            <Clock size={15} aria-hidden />{h.hours}
          </span>
        </div>
        <div className="izal-features">
          {h.features.map((f) => <span key={f} className="itag">{f}</span>)}
        </div>
        <div className="izal-foot">
          {h.dayPrice !== null && (
            <span className="itag itag-solid">{t("gyms.dayPass")} · {h.dayPrice} ₼</span>
          )}
          <a className="ibtn ibtn-sm" href={maps} target="_blank" rel="noreferrer noopener">
            <MapPin size={14} aria-hidden />{t("gyms.mapsCta")}
          </a>
        </div>

        {/* Trainers */}
        {h.trainers.length > 0 && (
          <section className="izal-sec" aria-label={t("gyms.trainersTitle")}>
            <h4>{t("gyms.trainersTitle")}</h4>
            <ul className="izal-coaches">
              {h.trainers.map((tr) => (
                <li key={tr.name}>
                  <span className="izal-avatar" aria-hidden>
                    {tr.name.charAt(0).toLocaleUpperCase("az")}
                  </span>
                  <span className="izal-coach-txt">
                    <b>{tr.name}</b>
                    <small>{tr.spec} · {t("gyms.trainerYears", { count: tr.years })}</small>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Equipment */}
        <section className="izal-sec" aria-label={t("gyms.equipTitle")}>
          <h4>{t("gyms.equipTitle")}</h4>
          <div className="izal-eq">
            {eqShown.map((label, idx) => (
              <span key={`${label}-${idx}`} className="itag">{label}</span>
            ))}
            {more > 0 && (
              <button type="button" className="itag itag-more" onClick={() => setEqOpen(true)}>
                +{more}
              </button>
            )}
          </div>
        </section>
      </div>
    </li>
  );
}

/* ── The app shell: glass sidebar + main column ─────────────────────────── */

const MOBILE_MQ = "(max-width: 1023px)";
const subscribeMobile = (cb: () => void) => {
  const mq = window.matchMedia(MOBILE_MQ);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const getMobileSnapshot = () => window.matchMedia(MOBILE_MQ).matches;
const getMobileServer = () => false;

const SECTION_LINKS: { key: keyof IdmanLinks; labelKey: string; icon: LucideIcon }[] = [
  { key: "home", labelKey: "nav.home", icon: House },
  { key: "diet", labelKey: "nav.diet", icon: Salad },
  { key: "meditation", labelKey: "nav.meditation", icon: Brain },
  { key: "library", labelKey: "nav.library", icon: BookOpen },
];

export function IdmanApp({
  user, catalog, initialTab = "plan", links, onThemeChange, embedded = false, tab, onTabChange,
}: IdmanAppProps) {
  const t = useTranslations("gymApp");
  const [ownTab, setOwnTab] = useState<IdmanTabId>(initialTab);
  const activeTab = embedded ? (tab ?? ownTab) : ownTab;
  const setTab = (id: IdmanTabId) => {
    setOwnTab(id);
    onTabChange?.(id);
  };
  const [deskOpen, setDeskOpen] = useState<boolean | null>(null); // null → default open
  const [mobOpen, setMobOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(true);
  const [dark, setDark] = useState(false);

  /* Direction-aware panel transitions — compare the tab order during
   * render (the "adjust state when props change" pattern) so the entering
   * panel carries the right class on its very first frame. */
  const [prevTab, setPrevTab] = useState<IdmanTabId>(activeTab);
  const [dir, setDir] = useState(1);
  if (prevTab !== activeTab) {
    const from = IDMAN_TABS.findIndex((x) => x.id === prevTab);
    const to = IDMAN_TABS.findIndex((x) => x.id === activeTab);
    setDir(to >= from ? 1 : -1);
    setPrevTab(activeTab);
  }

  /* The live breakpoint — an external store, no effect state dance. */
  const mobile = useSyncExternalStore(subscribeMobile, getMobileSnapshot, getMobileServer);
  const expanded = mobile ? mobOpen : (deskOpen ?? true);

  /* Restore the desktop rail choice + the live theme a frame after mount
   * (storage and the html class are browser-only). */
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      if (storeGet("pl:idman:rail") === "0") setDeskOpen(false);
      setDark(document.documentElement.classList.contains("dark"));
    });
    return () => cancelAnimationFrame(id);
  }, []);

  /* Escape closes the mobile overlay. */
  useEffect(() => {
    if (!mobile) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobOpen(false);
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [mobile]);

  const toggleRail = () => {
    if (mobile) { setMobOpen((v) => !v); return; }
    const next = !(deskOpen ?? true);
    setDeskOpen(next);
    storeSet("pl:idman:rail", next ? "1" : "0");
  };

  const pick = (id: IdmanTabId) => {
    setTab(id);
    if (mobile) setMobOpen(false);
  };

  const onGroupClick = () => {
    if (!expanded) {
      /* the collapsed rail expands first — on mobile that means the overlay */
      if (mobile) setMobOpen(true);
      else setDeskOpen(true);
      return;
    }
    setGroupOpen((v) => !v);
  };

  const toggleTheme = () => {
    /* exactly one of light/dark on <html> — matches both PreLife's own
     * toggle (html.dark) and next-themes' class convention. */
    const el = document.documentElement;
    const dark = !el.classList.contains("dark");
    el.classList.toggle("dark", dark);
    el.classList.toggle("light", !dark);
    setDark(dark);
    onThemeChange?.(dark);
  };

  const initial = (user.name || "S").charAt(0).toLocaleUpperCase("az");

  const panels: Record<IdmanTabId, ReactNode> = {
    plan: <PlanPanel catalog={catalog} />,
    supplements: <ShopPanel tab="supplements" catalog={catalog} />,
    accessories: <ShopPanel tab="accessories" catalog={catalog} />,
    gyms: <HallsPanel catalog={catalog} />,
    equipment: <ShopPanel tab="equipment" catalog={catalog} />,
  };

  /* The animated panel host — keyed by tab so each switch remounts and
   * enters from the travel direction (fade + 10px slide, 220ms). */
  const panelNode = (
    <div key={activeTab} className={dir === 1 ? "ipanel ipanel-fwd" : "ipanel ipanel-back"}>
      {panels[activeTab]}
    </div>
  );

  const head = {
    eyebrow: t(`heads.${activeTab}.eyebrow`),
    title: t(`heads.${activeTab}.title`),
    lede: t(`heads.${activeTab}.lede`),
  };

  /* ── Embedded: the main column only — the global AppShell owns the
   *  rail, the theme and the section links. ── */
  if (embedded) {
    return (
      <div className="idman idman-embed">
        <div className="imain" id="app-panel">
          <header className="ihead">
            <p className="ihead-eyebrow"><i aria-hidden />{head.eyebrow}</p>
            <h1 className="ihead-title">{head.title}</h1>
            <p className="ihead-lede">{head.lede}</p>
          </header>
          {panelNode}
        </div>
      </div>
    );
  }

  return (
    <div className="idman" data-open={expanded ? "open" : "closed"}>
      {/* Mobile scrim */}
      {mobile && expanded && (
        <button type="button" className="inav-scrim" aria-label={t("nav.railClose")} onClick={() => setMobOpen(false)} />
      )}

      {/* ── The glass sidebar ── */}
      <aside className="inav" aria-label={t("nav.railLabel")} data-open={expanded ? "open" : "closed"}>
        <div className="inav-top">
          <a className="inav-brand" href={links?.home ?? "#"} aria-label="PreLife">
            <span className="inav-brand-ic" aria-hidden><Dumbbell size={19} strokeWidth={2.2} /></span>
            {expanded && <span className="inav-brand-txt">Pre<em>Life</em></span>}
          </a>
          <button
            type="button"
            className="inav-fold"
            onClick={toggleRail}
            aria-label={expanded ? t("nav.railClose") : t("nav.railOpen")}
            aria-expanded={expanded}
          >
            <ChevronsUpDown size={16} aria-hidden />
          </button>
        </div>

        <div className="inav-clip">
          {/* Profile */}
          <div className="inav-profile">
            <span className="inav-avatar" aria-hidden>{initial}</span>
            {expanded && (
              <span className="inav-profile-txt">
                <b>{user.name}</b>
                <small>
                  <Crown size={11} aria-hidden /> {t("nav.premium")}
                </small>
              </span>
            )}
          </div>

          <nav className="inav-nav">
            {/* İdman group */}
            <div className="inav-group">
              <button
                type="button"
                className="inav-group-head"
                onClick={onGroupClick}
                aria-expanded={groupOpen}
                title={!expanded ? t("nav.group") : undefined}
              >
                <span className="inav-ic" aria-hidden><Dumbbell size={19} strokeWidth={2} /></span>
                {expanded && (
                  <>
                    <span className="inav-row-label">{t("nav.group")}</span>
                    <ChevronsUpDown
                      size={14} aria-hidden
                      className="inav-caret"
                      style={{ transform: groupOpen ? "rotate(180deg)" : "none" }}
                    />
                  </>
                )}
              </button>
              <div className={`inav-sub${groupOpen && expanded ? " open" : ""}`}>
                {IDMAN_TABS.map((tb) => (
                  <NavRow
                    key={tb.id}
                    icon={tabIcon(tb.id)}
                    label={t(`tab_${tb.id}`)}
                    open={expanded}
                    active={activeTab === tb.id}
                    onClick={() => pick(tb.id)}
                  />
                ))}
              </div>
            </div>

            {/* Other PreLife sections */}
            {SECTION_LINKS.map((s) => (
              <NavRow
                key={s.key}
                icon={s.icon}
                label={t(s.labelKey)}
                open={expanded}
                href={links?.[s.key] ?? "#"}
              />
            ))}
          </nav>

          {/* Notice card */}
          {expanded && (
            <div className="inav-card">
              <p className="inav-card-t">{t("nav.newsTitle")}</p>
              <p className="inav-card-b">{t("nav.newsBody")}</p>
            </div>
          )}
        </div>

        <div className="inav-foot">
          <button
            type="button"
            className="inav-foot-btn"
            onClick={toggleTheme}
            aria-label={t("nav.themeToggle")}
            title={t("nav.themeToggle")}
          >
            <span className="inav-ic" aria-hidden>
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </span>
            {expanded && <span className="inav-row-label">{dark ? t("nav.themeLight") : t("nav.themeDark")}</span>}
          </button>
          <a className="inav-foot-btn" href={links?.settings ?? "#"} aria-label={t("nav.settings")} title={t("nav.settings")}>
            <span className="inav-ic" aria-hidden><Settings size={18} /></span>
            {expanded && <span className="inav-row-label">{t("nav.settings")}</span>}
          </a>
        </div>
      </aside>

      {/* Mobile floating open button */}
      {mobile && !expanded && (
        <button
          type="button"
          className="inav-fab"
          onClick={() => setMobOpen(true)}
          aria-label={t("nav.railOpen")}
        >
          <Dumbbell size={18} aria-hidden />
        </button>
      )}

      {/* ── Main column ── */}
      <div className="imain">
        <header className="ihead">
          <p className="ihead-eyebrow"><i aria-hidden />{head.eyebrow}</p>
          <h1 className="ihead-title">{head.title}</h1>
          <p className="ihead-lede">{head.lede}</p>
        </header>
        {panelNode}
      </div>
    </div>
  );
}

function tabIcon(id: IdmanTabId): LucideIcon {
  switch (id) {
    case "plan": return CalendarDays;
    case "supplements": return Pill;
    case "accessories": return Shirt;
    case "gyms": return MapPin;
    case "equipment": return Dumbbell;
  }
}

export { isIdmanTabId };
