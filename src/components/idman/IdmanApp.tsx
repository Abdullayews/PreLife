"use client";

import {
  useCallback, useEffect, useMemo, useRef, useState,
  useSyncExternalStore,
  type CSSProperties, type ReactNode,
} from "react";
import {
  Brain, BookOpen, CalendarDays, ChevronsUpDown, Clock, Crown,
  Dumbbell, House, LoaderCircle, MapPin, Moon, Pill, Play, Salad, Search,
  SearchX, Settings, Shirt, Star, Sun, Wand2, X,
  type LucideIcon,
} from "lucide-react";
import {
  DAY_NAMES, DAY_SHORT, DEMO_PLAN, EQ_LABELS, EXERCISES, FILTER_GROUPS,
  HALLS, IDMAN_TABS, QUIZ, STORES, STORE_KIND_LABEL, TAB_HEADS, UI,
  isIdmanTabId, minPriceOf, minutesOf, muscleGroupsOf, productsOf,
  totalSetsOf,
  type ActivePlan, type Hall, type IdmanTabId, type PlanDay,
  type PlanExercise, type Product, type QuizAnswers,
} from "./data";

/**
 * İdman v3 — the redesigned gym surface.
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
 *    and a completion toggle each) and the weekly strip. When the API is
 *    unreachable (offline, standalone demos) the client-side twin of the
 *    starter plan from ./data steps in.
 *  • supplements / accessories / equipment — search + filter-chip + sort
 *    catalogs on a 4-column grid (equipment carries a real video per item).
 *  • gyms — hall cards: info & location on top, trainers below, then the
 *    hall's equipment floor.
 *
 * Self-contained by design: embedded data (./data.ts), its own CSS
 * (the "İdman v3" block in globals.css), zero app imports (only plain
 * relative /api/gym/plan fetches) — the same file
 * runs inside PreLife (/[locale]/gym) and in standalone demos.
 */

/* ── Props ──────────────────────────────────────────────────────────────── */

export type IdmanLinks = {
  home?: string; diet?: string; meditation?: string; library?: string; settings?: string;
};

export type IdmanAppProps = {
  user?: { name: string; email?: string | null };
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

const fill = (tpl: string, ...vals: (string | number)[]): string => {
  let out = tpl;
  vals.forEach((v) => { out = out.replace(/\{[^}]+\}/, String(v)); });
  return out;
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
/** The plan's 1..7 → JS numbering (the DAY_* label keys). */
const jsDayOf = (planDay: number): number => (planDay === 7 ? 0 : planDay);

type PlanStatus = "loading" | "quiz" | "ready";

function PlanPanel() {
  const [plan, setPlan] = useState<ActivePlan | null>(null);
  const [status, setStatus] = useState<PlanStatus>("loading");
  const [busy, setBusy] = useState(false);
  const [offlineNote, setOfflineNote] = useState(false);

  /* Load the active plan — the server lazily creates the starter plan and
   * tells whether the questionnaire was already completed. When the API is
   * unreachable (offline, standalone demos) the client-side twin of the
   * starter plan steps in. */
  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/gym/plan?locale=az", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { plan: ActivePlan | null; onboardingDone: boolean };
      setPlan(data.plan ?? DEMO_PLAN);
      setStatus(data.onboardingDone ? "ready" : "quiz");
    } catch {
      setPlan(DEMO_PLAN);
      setStatus("ready");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  /* The questionnaire's answers → a personal plan (AI, rules fallback). */
  const build = useCallback(async (answers: QuizAnswers) => {
    setBusy(true);
    try {
      const res = await fetch("/api/gym/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: "az", answers }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { plan: ActivePlan | null };
      if (!data.plan) throw new Error("no plan");
      setPlan(data.plan);
      setOfflineNote(false);
      setStatus("ready");
    } catch {
      /* offline — keep showing the standard plan + a small note */
      setOfflineNote(true);
      setPlan((p) => p ?? DEMO_PLAN);
      setStatus("ready");
    } finally {
      setBusy(false);
    }
  }, []);

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
        <p className="iplan-rest">{UI.planLoading}</p>
      </div>
    );
  }

  if (status === "quiz" || !plan) {
    return <PlanQuiz busy={busy} onCancel={() => setStatus("ready")} onSubmit={build} />;
  }

  return (
    <PlanView
      plan={plan}
      busy={busy}
      note={offlineNote}
      onBuild={() => { setOfflineNote(false); setStatus("quiz"); }}
      onReset={reset}
    />
  );
}

/* ── The active plan view (hero + today's session + weekly strip) ───────── */

function PlanView({
  plan, busy, note, onBuild, onReset,
}: {
  plan: ActivePlan;
  busy: boolean;
  /** the last personal-plan POST failed — show the offline note. */
  note: boolean;
  onBuild: () => void;
  onReset: () => void;
}) {
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
  const groups = muscleGroupsOf(day);
  const minutes = minutesOf(day);
  const sets = totalSetsOf(day);
  const weekPct = Math.max(0, Math.min(100, Math.round((plan.week / Math.max(1, plan.total)) * 100)));

  return (
    <div className="iplan">
      {/* Active plan header */}
      <div className="iplan-hero" style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
        <div className="iplan-hero-body">
          <p className="iplan-eyebrow"><span className="iplan-eyebrow-i" aria-hidden />{UI.activeEyebrow}</p>
          <h2 className="iplan-hero-title">{plan.title}</h2>
          {plan.focus && <p className="iplan-hero-desc">{plan.focus}</p>}
          <div className="iplan-hero-meta">
            {plan.level && <span className="itag itag-solid">{plan.level}</span>}
            <span className="itag">{plan.source === "ai" ? UI.aiTag : UI.defaultTag}</span>
            <span className="itag">{fill(UI.weekLabel, plan.week, plan.total)}</span>
            <span className="itag">{fill(UI.daysPerWeek, plan.days.length)}</span>
          </div>
          <div
            className="iplan-bar"
            role="progressbar"
            aria-valuenow={weekPct}
            aria-valuemin={0} aria-valuemax={100}
            aria-label={fill(UI.weekLabel, plan.week, plan.total)}
          >
            <i style={{ width: `${weekPct}%` }} />
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: ".5rem", marginTop: ".2rem" }}>
            <button type="button" className="ibtn ibtn-sm" onClick={onBuild} disabled={busy}>
              <Wand2 size={15} aria-hidden />{UI.buildCta}
            </button>
            <button type="button" className="ibtn ibtn-sm ibtn-ghost" onClick={onReset} disabled={busy}>
              {UI.resetCta}
            </button>
          </div>
          {note && <p className="iplan-rest">{UI.offlineNote}</p>}
        </div>
      </div>

      {/* Today's session: sticky summary + exercise cards */}
      <div className="iplan-grid">
        <aside className="iplan-side" aria-label={UI.sessionSummary}>
          <div className="iplan-side-card">
            <p className="iplan-side-day">
              {isToday ? UI.todayTitle : UI.nextSession}
            </p>
            <p className="iplan-side-date">
              {DAY_NAMES[jsDayOf(day.day)] ?? ""}
            </p>
            {day.focus && (
              <p style={{ margin: 0, fontSize: ".8rem", fontWeight: 600, color: "var(--muted)" }}>
                {day.focus}
              </p>
            )}

            {!isToday && <p className="iplan-rest">{UI.restDay}</p>}

            <div className="iplan-stats">
              <div><b>{total}</b><span>hərəkət</span></div>
              <div><b>{sets}</b><span>yanaşma</span></div>
              <div><b>~{minutes}</b><span>dəqiqə</span></div>
            </div>

            <p className="iplan-side-sub">{UI.muscleGroups}</p>
            <ul className="iplan-chips">
              {groups.map((g) => <li key={g} className="itag">{g}</li>)}
            </ul>

            <ol className="iplan-list">
              {day.exercises.map((pe, i) => (
                <li key={i} className={done.has(String(i)) ? "done" : undefined}>
                  <span className="iplan-list-n" aria-hidden>{i + 1}</span>
                  <span className="iplan-list-name">{pe.name}</span>
                  <span className="iplan-list-dose">{pe.sets} × {pe.reps}</span>
                </li>
              ))}
            </ol>

            <div className="iplan-progress">
              <div className="iplan-bar small" aria-hidden>
                <i style={{ width: `${total ? Math.round((doneCount / total) * 100) : 0}%` }} />
              </div>
              <p className="iplan-progress-txt">{fill(UI.sessionProgress, doneCount, total)}</p>
              {allDone && <p className="iplan-finished">{UI.finished}</p>}
            </div>
          </div>
        </aside>

        <div className="iplan-cards">
          {!isToday && (
            <p className="iplan-next-hint">
              {UI.restDay} — {UI.nextSession}: <b>{DAY_NAMES[jsDayOf(day.day)]}</b>
            </p>
          )}
          <ul className="iex-grid">
            {day.exercises.map((pe, i) => (
              <ExerciseCard
                key={i}
                index={i}
                pe={pe}
                done={done.has(String(i))}
                onToggle={() => toggleDone(String(i))}
              />
            ))}
          </ul>
        </div>
      </div>

      {/* Weekly strip */}
      <section className="iplan-week" aria-label={UI.weeklyTitle}>
        <p className="iplan-side-sub">{UI.weeklyTitle}</p>
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
                <span className="iplan-week-name">{DAY_SHORT[d]}</span>
                <span className="iplan-week-tag">{has ? UI.workoutTag : UI.restTag}</span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
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
  const [step, setStep] = useState(0);
  /* one pick list per step (multi steps hold up to `multi` options) */
  const [picked, setPicked] = useState<string[][]>(() => QUIZ.steps.map(() => []));
  const [text, setText] = useState("");

  const s = QUIZ.steps[step] ?? QUIZ.steps[0];
  const last = step === QUIZ.steps.length - 1;
  const chosen = picked[step] ?? [];
  const canNext = Boolean(s.free) || chosen.length > 0;

  const pick = (option: string) => {
    setPicked((prev) => prev.map((sel, i) => {
      if (i !== step) return sel;
      const has = sel.includes(option);
      if (s.multi) {
        return has ? sel.filter((o) => o !== option)
          : sel.length >= s.multi ? sel : [...sel, option];
      }
      return has ? [] : [option];
    }));
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
    setStep(step + 1);
  };

  return (
    <div className="iplan">
      <div className="iplan-hero" style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
        <div className="iplan-hero-body">
          <p className="iplan-eyebrow"><span className="iplan-eyebrow-i" aria-hidden />{QUIZ.eyebrow}</p>
          <h2 className="iplan-hero-title">{QUIZ.title}</h2>
          <p className="iplan-hero-desc">{QUIZ.desc}</p>
          <div className="iplan-hero-meta">
            <span className="itag itag-solid">{fill(QUIZ.stepOf, step + 1, QUIZ.steps.length)}</span>
          </div>

          <h3 style={{ margin: ".4rem 0 0", font: "600 1.15rem/1.3 var(--font-display)", letterSpacing: "-.01em" }}>
            {s.q}
          </h3>

          {s.free ? (
            <>
              <textarea
                value={text}
                rows={3}
                placeholder={QUIZ.limitPlaceholder}
                aria-label={s.q}
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
                    {QUIZ.none}
                  </button>
                </li>
              </ul>
            </>
          ) : (
            <ul className="ishop-chips" aria-label={s.q}>
              {s.options.map((o) => (
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

          <div style={{ display: "flex", flexWrap: "wrap", gap: ".5rem", marginTop: ".3rem" }}>
            <button
              type="button"
              className="ibtn ibtn-ghost ibtn-sm"
              onClick={step === 0 ? onCancel : () => setStep(step - 1)}
              disabled={busy}
            >
              {QUIZ.back}
            </button>
            <button type="button" className="ibtn ibtn-sm" onClick={next} disabled={!canNext || busy}>
              {busy
                ? <><LoaderCircle size={15} className="spin" aria-hidden />{QUIZ.busy}</>
                : (last ? QUIZ.finish : QUIZ.next)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ExerciseCard({
  index, pe, done, onToggle,
}: {
  index: number; pe: PlanExercise; done: boolean; onToggle: () => void;
}) {
  const ex = EXERCISES[pe.ex]; // registry move? undefined → custom AI move
  const [open, setOpen] = useState(false);
  return (
    <li className={`iex${done ? " done" : ""}`}>
      <div
        className="iex-media"
        style={ex ? undefined : {
          /* custom AI move — no video: a centered dumbbell placeholder */
          aspectRatio: "16 / 10", background: "var(--tint)",
          display: "grid", placeItems: "center",
        }}
      >
        {ex
          ? <VideoTile src={ex.video} label={`${ex.name} — demo video`} tall />
          : <Dumbbell size={30} strokeWidth={1.5} aria-hidden style={{ color: "var(--muted)" }} />}
        <span className="iex-n" aria-hidden>{index + 1}</span>
      </div>
      <div className="iex-body">
        <div className="iex-top">
          <h3 className="iex-name">{pe.name}</h3>
          <span className="iex-dose">{pe.sets} × {pe.reps}</span>
        </div>
        {ex && <p className="iex-target">{ex.target}</p>}
        {pe.note && <p className="iex-rest" style={{ fontStyle: "italic" }}>{pe.note}</p>}
        <p className="iex-rest">
          <Clock size={14} aria-hidden />
          {pe.rest > 0 ? fill(UI.restLabel, pe.rest) : UI.flowLine}
        </p>
        {ex && (
          <details className="iex-guide" open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
            <summary>{UI.howTo}</summary>
            <p>{ex.guide}</p>
          </details>
        )}
        <button
          type="button"
          className={`ibtn iex-done${done ? " done" : ""}`}
          aria-pressed={done}
          onClick={onToggle}
        >
          {done ? <><X size={15} aria-hidden />{UI.done}</> : UI.done}
        </button>
      </div>
    </li>
  );
}

/* ── Panel: catalogs (supplements / accessories / equipment) ────────────── */

type ShopTab = "supplements" | "accessories" | "equipment";

function ShopPanel({ tab }: { tab: ShopTab }) {
  const items = useMemo(
    () => productsOf(tab === "accessories" ? ["accessories", "clothing"] : [tab]),
    [tab],
  );

  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<string>("all");
  const [sort, setSort] = useState<"popular" | "cheap">("popular");

  const groups = FILTER_GROUPS[tab];

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = items.filter((p) => {
      if (group !== "all" && p.group !== group) return false;
      if (!q) return true;
      const hay = [
        p.name, p.brand,
        ...p.at.map((a) => STORES[a.store]?.name ?? ""),
      ].join(" ").toLowerCase();
      return hay.includes(q);
    });
    if (sort === "cheap") list = [...list].sort((a, b) => minPriceOf(a) - minPriceOf(b));
    return list;
  }, [items, query, group, sort]);

  return (
    <div className="ishop">
      <div className="ishop-bar">
        <div className="isearch">
          <Search size={16} aria-hidden />
          <input
            type="search"
            value={query}
            placeholder={UI.searchPlaceholder}
            aria-label={UI.searchLabel}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query !== "" && (
            <button type="button" className="isearch-x" aria-label={UI.searchClear} onClick={() => setQuery("")}>
              <X size={14} aria-hidden />
            </button>
          )}
        </div>
        <div className="iseg" role="group" aria-label={UI.sortLabel}>
          <button type="button" aria-pressed={sort === "popular"} onClick={() => setSort("popular")}>{UI.sortPopular}</button>
          <button type="button" aria-pressed={sort === "cheap"} onClick={() => setSort("cheap")}>{UI.sortCheap}</button>
        </div>
      </div>

      <ul className="ishop-chips" aria-label={UI.filterLabel}>
        <li>
          <button type="button" className="ichip" aria-pressed={group === "all"} onClick={() => setGroup("all")}>
            {UI.filterAll}
          </button>
        </li>
        {groups.map((g) => (
          <li key={g}>
            <button type="button" className="ichip" aria-pressed={group === g} onClick={() => setGroup(g)}>
              {g}
            </button>
          </li>
        ))}
      </ul>

      <output className="sr-only" aria-live="polite">
        {fill(UI.resultsA11y, shown.length, items.length)}
      </output>

      <p className="ishop-note">{UI.shopNote}</p>

      {shown.length === 0 ? (
        <div className="iempty">
          <SearchX size={22} aria-hidden />
          <p><b>{UI.noResults}</b></p>
          <button type="button" className="ibtn ibtn-sm ibtn-ghost" onClick={() => { setQuery(""); setGroup("all"); }}>
            {UI.filterAll}
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

function ProductCard({ p, i }: { p: Product; i: number }) {
  const cheapest = minPriceOf(p);
  const best = p.at.findIndex((a) => a.price === cheapest);
  return (
    <li className="iprod" style={{ "--i": i } as CSSProperties}>
      {p.video ? (
        <VideoTile src={p.video} label={`${p.name} — demo video`} />
      ) : (
        <div className="iprod-img">
          <img src={p.image} alt="" width={480} height={360} loading="lazy" decoding="async" />
        </div>
      )}
      <div className="iprod-body">
        <p className="iprod-brand">{p.brand}</p>
        <h3 className="iprod-name">{p.name}</h3>
        <div className="iprod-rate">
          <Star size={13} fill="currentColor" aria-hidden />
          <b>{p.rating.toFixed(1)}</b>
          <span className="sr-only">{fill(UI.ratingA11y, p.rating.toFixed(1))}</span>
        </div>
        <p className="iprod-price">{p.price[0]}–{p.price[1]} ₼</p>
        <div className="iprod-offers">
          <p className="iprod-offers-t">{fill(UI.atCount, p.at.length)}</p>
          {p.at.map((a, idx) => {
            const s = STORES[a.store];
            if (!s) return null;
            return (
              <a
                key={a.store}
                className={`iprod-offer${idx === best ? " best" : ""}`}
                href={s.url}
                target="_blank"
                rel="noreferrer noopener"
              >
                <span className="iprod-offer-name">{s.name}</span>
                <span className="iprod-offer-kind">{STORE_KIND_LABEL[s.kind]}</span>
                <span className="iprod-offer-price">{a.price} ₼</span>
                {idx === best && <span className="itag itag-solid">{UI.bestPrice}</span>}
              </a>
            );
          })}
        </div>
      </div>
    </li>
  );
}

/* ── Panel: halls (zallar) ──────────────────────────────────────────────── */

function HallsPanel() {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"rating" | "price">("rating");
  const [active, setActive] = useState<string[]>([]);

  const features = useMemo(() => {
    const set = new Set<string>();
    for (const h of HALLS) for (const f of h.features) set.add(f);
    return [...set];
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = HALLS.filter((h) => {
      if (active.length > 0 && !active.some((f) => h.features.includes(f))) return false;
      if (!q) return true;
      return `${h.name} ${h.desc} ${h.address}`.toLowerCase().includes(q);
    });
    list = [...list].sort((a, b) =>
      sort === "rating" ? b.rating - a.rating : a.dayPrice - b.dayPrice);
    return list;
  }, [query, sort, active]);

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
            placeholder={UI.searchPlaceholder}
            aria-label={UI.searchLabel}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query !== "" && (
            <button type="button" className="isearch-x" aria-label={UI.searchClear} onClick={() => setQuery("")}>
              <X size={14} aria-hidden />
            </button>
          )}
        </div>
        <div className="iseg" role="group" aria-label={UI.sortLabel}>
          <button type="button" aria-pressed={sort === "rating"} onClick={() => setSort("rating")}>{UI.sortRating}</button>
          <button type="button" aria-pressed={sort === "price"} onClick={() => setSort("price")}>{UI.sortPrice}</button>
        </div>
      </div>

      <ul className="ishop-chips" aria-label={UI.filterLabel}>
        <li>
          <button type="button" className="ichip" aria-pressed={active.length === 0} onClick={() => setActive([])}>
            {UI.filterAll}
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
        {fill(UI.resultsA11y, shown.length, HALLS.length)}
      </output>

      {shown.length === 0 ? (
        <div className="iempty">
          <SearchX size={22} aria-hidden />
          <p><b>{UI.gymsNoResults}</b></p>
          <button type="button" className="ibtn ibtn-sm ibtn-ghost" onClick={() => { setQuery(""); setActive([]); }}>
            {UI.filterAll}
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

function HallCard({ h, i }: { h: Hall; i: number }) {
  const [eqOpen, setEqOpen] = useState(false);
  const eqShown = eqOpen ? h.equipment : h.equipment.slice(0, 8);
  const more = h.equipment.length - eqShown.length;
  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`Baku ${h.name} ${h.address}`)}`;
  return (
    <li className="izal-card" style={{ "--i": i } as CSSProperties}>
      <div className="izal-img">
        <img src={h.image} alt="" width={800} height={533} loading="lazy" decoding="async" />
        <span className="izal-score" role="img" aria-label={fill(UI.ratingA11y, h.rating.toFixed(1))}>
          <Star size={14} fill="currentColor" aria-hidden />{h.rating.toFixed(1)}
        </span>
      </div>
      <div className="izal-body">
        <h3 className="izal-name">{h.name}</h3>
        <p className="izal-desc">{h.desc}</p>
        <div className="izal-meta">
          <span><MapPin size={15} aria-hidden />{h.address}</span>
          <span>
            <span className="sr-only">{UI.openHoursSr}: </span>
            <Clock size={15} aria-hidden />{h.hours}
          </span>
        </div>
        <div className="izal-features">
          {h.features.map((f) => <span key={f} className="itag">{f}</span>)}
        </div>
        <div className="izal-foot">
          <span className="itag itag-solid">{UI.dayPass} · {h.dayPrice} ₼</span>
          <a className="ibtn ibtn-sm" href={maps} target="_blank" rel="noreferrer noopener">
            <MapPin size={14} aria-hidden />{UI.mapsCta}
          </a>
        </div>

        {/* Trainers */}
        <section className="izal-sec" aria-label={UI.trainersTitle}>
          <h4>{UI.trainersTitle}</h4>
          <ul className="izal-coaches">
            {h.trainers.map((t) => (
              <li key={t.name}>
                <span className="izal-avatar" aria-hidden>
                  {t.name.charAt(0).toLocaleUpperCase("az")}
                </span>
                <span className="izal-coach-txt">
                  <b>{t.name}</b>
                  <small>{t.spec} · {fill(UI.trainerYears, t.years)}</small>
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Equipment */}
        <section className="izal-sec" aria-label={UI.equipTitle}>
          <h4>{UI.equipTitle}</h4>
          <div className="izal-eq">
            {eqShown.map((code) => (
              <span key={code} className="itag">{EQ_LABELS[code] ?? code}</span>
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

const SECTION_LINKS: { key: keyof IdmanLinks; label: string; icon: LucideIcon }[] = [
  { key: "home", label: "Ana səhifə", icon: House },
  { key: "diet", label: "Qidalanma", icon: Salad },
  { key: "meditation", label: "Psixologiya", icon: Brain },
  { key: "library", label: "Kitablar", icon: BookOpen },
];

export function IdmanApp({
  user, initialTab = "plan", links, onThemeChange, embedded = false, tab, onTabChange,
}: IdmanAppProps) {
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

  const head = TAB_HEADS[activeTab];
  const initial = (user?.name || "S").charAt(0).toLocaleUpperCase("az");

  const panels: Record<IdmanTabId, ReactNode> = {
    plan: <PlanPanel />,
    supplements: <ShopPanel tab="supplements" />,
    accessories: <ShopPanel tab="accessories" />,
    gyms: <HallsPanel />,
    equipment: <ShopPanel tab="equipment" />,
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
          {panels[activeTab]}
        </div>
      </div>
    );
  }

  return (
    <div className="idman" data-open={expanded ? "open" : "closed"}>
      {/* Mobile scrim */}
      {mobile && expanded && (
        <button type="button" className="inav-scrim" aria-label={UI.railClose} onClick={() => setMobOpen(false)} />
      )}

      {/* ── The glass sidebar ── */}
      <aside className="inav" aria-label={UI.railLabel} data-open={expanded ? "open" : "closed"}>
        <div className="inav-top">
          <a className="inav-brand" href={links?.home ?? "#"} aria-label="PreLife">
            <span className="inav-brand-ic" aria-hidden><Dumbbell size={19} strokeWidth={2.2} /></span>
            {expanded && <span className="inav-brand-txt">Pre<em>Life</em></span>}
          </a>
          <button
            type="button"
            className="inav-fold"
            onClick={toggleRail}
            aria-label={expanded ? UI.railClose : UI.railOpen}
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
                  <Crown size={11} aria-hidden /> {UI.premium}
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
                title={!expanded ? "İdman" : undefined}
              >
                <span className="inav-ic" aria-hidden><Dumbbell size={19} strokeWidth={2} /></span>
                {expanded && (
                  <>
                    <span className="inav-row-label">İdman</span>
                    <ChevronsUpDown
                      size={14} aria-hidden
                      className="inav-caret"
                      style={{ transform: groupOpen ? "rotate(180deg)" : "none" }}
                    />
                  </>
                )}
              </button>
              <div className={`inav-sub${groupOpen && expanded ? " open" : ""}`}>
                {IDMAN_TABS.map((t) => (
                  <NavRow
                    key={t.id}
                    icon={tabIcon(t.id)}
                    label={t.label}
                    open={expanded}
                    active={activeTab === t.id}
                    onClick={() => pick(t.id)}
                  />
                ))}
              </div>
            </div>

            {/* Other PreLife sections */}
            {SECTION_LINKS.map((s) => (
              <NavRow
                key={s.key}
                icon={s.icon}
                label={s.label}
                open={expanded}
                href={links?.[s.key] ?? "#"}
              />
            ))}
          </nav>

          {/* Notice card */}
          {expanded && (
            <div className="inav-card">
              <p className="inav-card-t">{UI.newsTitle}</p>
              <p className="inav-card-b">{UI.newsBody}</p>
            </div>
          )}
        </div>

        <div className="inav-foot">
          <button
            type="button"
            className="inav-foot-btn"
            onClick={toggleTheme}
            aria-label={UI.themeToggle}
            title={UI.themeToggle}
          >
            <span className="inav-ic" aria-hidden>
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </span>
            {expanded && <span className="inav-row-label">{dark ? UI.themeLight : UI.themeDark}</span>}
          </button>
          <a className="inav-foot-btn" href={links?.settings ?? "#"} aria-label={UI.settings} title={UI.settings}>
            <span className="inav-ic" aria-hidden><Settings size={18} /></span>
            {expanded && <span className="inav-row-label">{UI.settings}</span>}
          </a>
        </div>
      </aside>

      {/* Mobile floating open button */}
      {mobile && !expanded && (
        <button
          type="button"
          className="inav-fab"
          onClick={() => setMobOpen(true)}
          aria-label={UI.railOpen}
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
        {panels[activeTab]}
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
