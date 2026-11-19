"use client";

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  ArrowUpRight, CheckCircle2, ChevronLeft, Clock, Dumbbell, Info,
  MapPin, Search, SearchX, Star, Trophy, X,
  type LucideIcon,
} from "lucide-react";
import { hasConsent } from "@/lib/consent";
import { iconByName } from "@/lib/icons";
import { AppShell } from "@/components/AppShell";
import { Modal } from "@/components/Modal";
import {
  GYM_TABS, isShopTab,
  type GymTabId, type ShopTabId,
} from "@/lib/gym";

/**
 * The registered-surface gym app: six subtabs (plan, gyms and the four
 * shop directories) inside the shared AppShell — the compact left rail
 * switches the panel on the right.
 *
 * v2 (this rewrite):
 * • plan — the all-plans grid moved BEHIND a "Planımı dəyişdir" dialog
 *   at the bottom of the tab; "İdməna başla" opens a workout-session
 *   view: today's planned exercises with a how-to guide line and a
 *   classic "Tamamlandı" checkbox each, a live progress bar and a
 *   finish action that checks the day off.
 * • gyms — each hall is a compact card with an "Ətraflı" button that
 *   opens a dialog: the hall's own info, its FULL equipment list and
 *   its trainer team.
 * • shop — every product carries a photo; the catalogs grew.
 *
 * Every string arrives pre-translated from the server (the page builds
 * `strings` with getTranslations) — this component is locale-agnostic,
 * which keeps the client bundle free of the message catalogues.
 */

/* ── View models (fully server-resolved) ───────────────────────────────── */

export type PlanView = {
  id: string;
  name: string;
  desc: string;
  level: string;
  meta: string[];
  image: string;
  featured: boolean;
  weekLabel: string;
  percent: number;
  progressA11y: string;
};

/** One exercise inside a session day — name, target, the how-to guide
 *  and the pre-rendered sets/rest prescription lines. */
export type SessionExerciseView = {
  id: string;
  name: string;
  target: string;
  guide: string;
  /** "3 × 8–12 təkrar" — composed server-side. */
  setsLabel: string;
  /** "Dinclik: 90 san" / "Ardıcıl" — composed server-side. */
  restLabel: string;
};

/** Per plan: weekday (1 Mon … 6 Sat) → the day's exercises (a missing
 *  day = rest day). The client picks today's row post-mount. */
export type SessionPlanView = Record<number, SessionExerciseView[]>;

export type GymView = {
  id: string;
  name: string;
  desc: string;
  image: string;
  rating: number;
  ratingA11y: string;
  features: string[];
  address: string;
  hours: string;
  dayPrice: number;
  /* ── Details-dialog content ── */
  equipment: string[];
  trainers: { name: string; spec: string; years: number }[];
  trainerYears: string;
};

export type ShopItemView = {
  id: string;
  name: string;
  brand: string;
  /** Lucide icon name (lib/icons.ts registry) — resolved client-side. */
  icon: string;
  priceLabel: string;
  /** Product photo (OSS/Unsplash URL) — the card keeps its icon chip
   *  as a fallback when null. */
  image: string | null;
  /** Cheapest of the store prices — drives the cheap sort. */
  minPrice: number;
  /** Index into `at` of the cheapest store (ties: first). */
  best: number;
  /** "Stores: 3"-style line, pre-localized with the count. */
  countLabel: string;
  at: { name: string; kind: string; url: string; price: number }[];
};

export type GymAppStrings = {
  tabs: Record<GymTabId, string>;
  railLabel: string;
  railOpen: string;
  railClose: string;
  railTitle: string;
  currentTabSr: string;
  heads: Record<GymTabId, { eyebrow: string; title: string }>;
  shopNote: string;
  whereToBuy: string;
  bestPrice: string;
  sortLabel: string;
  sortPopular: string;
  sortCheap: string;
  searchLabel: string;
  searchPlaceholder: string;
  searchClear: string;
  /** "{shown} / {total}"-style template — {shown}/{total} are replaced client-side. */
  resultsA11y: string;
  noResults: string;
  plans: PlanView[];
  planUi: {
    activeEyebrow: string;
    activeTag: string;
    select: string;
    plansEyebrow: string;
    scheduleEyebrow: string;
    scheduleA11y: string;
    timeCol: string;
    /* ── "İdməna başla" session view ── */
    start: string;
    sessionTitle: string;
    restDay: string;
    back: string;
    howTo: string;
    done: string;
    finish: string;
    finished: string;
    /** "{done}/{total} hərəkət" — filled client-side. */
    sessionProgress: string;
    sessionProgressA11y: string;
    /* ── "Planımı dəyişdir" dialog ── */
    change: string;
    changeTitle: string;
    close: string;
  };
  /** Per-plan workout days (weekday → exercises). */
  sessions: Record<string, SessionPlanView>;
  /** Mon..Sat labels for the session header (Sunday = rest day). */
  dayNames: string[];
  schedule: {
    days: string[];
    slots: { time: string; label: string; cells: { label: string; kind: number }[] }[];
  };
  gyms: GymView[];
  gymsUi: {
    dayPass: string;
    mapsCta: string;
    openHoursSr: string;
    sortRating: string;
    sortPrice: string;
    filterLabel: string;
    filterAll: string;
    gymsNoResults: string;
    details: string;
    close: string;
    aboutTitle: string;
    equipTitle: string;
    trainersTitle: string;
  };
  shops: Record<ShopTabId, ShopItemView[]>;
};

type Props = {
  initialTab: GymTabId;
  /** The featured plan starts active (v1 mock progress, client-side only). */
  initialPlan: string;
  /** A valid ?tab= came in the URL — the client then skips restoring its
   *  remembered tab: shareable deep links always win. */
  linked: boolean;
  strings: GymAppStrings;
  /** The signed-in account — rides to the rail for the management panel. */
  user: { name: string | null; email: string };
  /** The server-rendered page header (title) — sits above the panels. */
  children: ReactNode;
};

/* ── Shop ordering ─────────────────────────────────────────────────────── */

type ShopSort = "popular" | "cheap";

/* ── Persistence (consent-gated, in-session without it) ────────────────── */

const LS_TAB = "pl:gym:tab";
const LS_PLAN = "pl:gym:plan";
/** pl:gym:done:<planId> = YYYY-MM-DD (Baku) — the last day checked off. */
const LS_DONE = "pl:gym:done:";
/** pl:gym:session:<planId> = "YYYY-MM-DD|idx,idx,…" — the in-progress
 *  session check-offs; a new date resets the list automatically. */
const LS_SESSION = "pl:gym:session:";

const readStored = (key: string): string | null => {
  if (!hasConsent()) return null;
  try { return localStorage.getItem(key); } catch { return null; }
};

const store = (key: string, value: string): void => {
  if (!hasConsent()) return;
  try { localStorage.setItem(key, value); } catch { /* private mode */ }
};

/* ── Small helpers ─────────────────────────────────────────────────────── */

const mapsUrl = (name: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} Bakı`)}`;

/** Today's schedule column in Baku wall time — Mon..Sat → 0..5, else -1.
 *  Called from an effect only, so SSR and hydration never disagree. */
const bakuToday = (): number => {
  const dow = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "Asia/Baku" })
    .format(new Date());
  return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(dow);
};

/** Today as YYYY-MM-DD in Baku wall time (en-CA renders that exact shape). */
const bakuTodayStr = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Baku" }).format(new Date());

/** "{shown} / {total}"-style templates carry their placeholders verbatim. */
const fillCount = (tpl: string, shown: number, total: number) =>
  tpl.replace("{shown}", String(shown)).replace("{total}", String(total));

const fillSession = (tpl: string, done: number, total: number) =>
  tpl.replace("{done}", String(done)).replace("{total}", String(total));

/* ── Shell ─────────────────────────────────────────────────────────────── */

export function GymApp({ initialTab, initialPlan, linked, strings, user, children }: Props) {
  const [tab, setTab] = useState<GymTabId>(initialTab);
  const [activePlan, setActivePlan] = useState(initialPlan);
  const [shopSort, setShopSort] = useState<ShopSort>("popular");
  const [query, setQuery] = useState("");
  const [todayIdx, setTodayIdx] = useState(-1);

  /* Restore the last choices after mount (a deep link beats the
   * remembered tab). */
  useEffect(() => {
    if (!linked) {
      const remembered = readStored(LS_TAB);
      if (remembered && GYM_TABS.some((x) => x.id === remembered)) {
        setTab(remembered as GymTabId);
      }
    }
    const plan = readStored(LS_PLAN);
    if (plan && strings.plans.some((p) => p.id === plan)) setActivePlan(plan);
    setTodayIdx(bakuToday());
  }, [linked, strings.plans]);

  const selectTab = (id: GymTabId) => {
    setTab(id);
    setQuery(""); // the search box is scoped to one shop view — reset on switch
    store(LS_TAB, id);
    // Keep ?tab= in sync so the link is shareable / survives a refresh —
    // plain history.replaceState, no refetch, no scroll.
    window.history.replaceState(null, "", `?tab=${id}`);
  };

  const choosePlan = (id: string) => {
    setActivePlan(id);
    store(LS_PLAN, id);
  };

  const head = strings.heads[tab];

  return (
    <AppShell
      mode="tab"
      tabs={GYM_TABS.map(({ id, icon }) => ({ id, label: strings.tabs[id], icon }))}
      activeId={tab}
      hrefs={{}}
      onSelect={(id) => selectTab(id as GymTabId)}
      user={user}
      ui={{
        label: strings.railLabel,
        open: strings.railOpen,
        close: strings.railClose,
        current: strings.currentTabSr,
        title: strings.railTitle,
      }}
      storageKey="pl:gym:rail"
    >
      <div className="wrap gym-wrap">
        {children}
        <div
          key={tab === "plan" ? `plan-${activePlan}` : tab}
          className="gym-panel"
          role="tabpanel"
          id="app-panel"
          aria-label={strings.tabs[tab]}
        >
          <header className="gym-panel-head">
            <p className="eyebrow"><i />{head.eyebrow}</p>
            <h2 className="h3">{head.title}</h2>
          </header>

          {tab === "plan" && (
            <PlanPanel
              strings={strings}
              activePlan={activePlan}
              todayIdx={todayIdx}
              onSelectPlan={choosePlan}
            />
          )}
          {tab === "gyms" && <GymsPanel strings={strings} />}
          {isShopTab(tab) && (
            <ShopPanel
              tab={tab}
              items={strings.shops[tab]}
              ui={strings}
              sort={shopSort}
              onSort={setShopSort}
              query={query}
              onQuery={setQuery}
            />
          )}
        </div>
      </div>
    </AppShell>
  );
}

/* ── Idman planı — hero + session view + change-plan dialog ────────────── */

function PlanPanel({
  strings, activePlan, todayIdx, onSelectPlan,
}: {
  strings: GymAppStrings;
  activePlan: string;
  /** Today's column (Baku time) or -1 — set post-mount, highlights th/td. */
  todayIdx: number;
  onSelectPlan: (id: string) => void;
}) {
  const { plans, planUi, schedule } = strings;
  const current = plans.find((p) => p.id === activePlan) ?? plans[0]!;

  /* ── Session state: open view + per-exercise check-offs ── */
  const [session, setSession] = useState(false);
  const [checked, setChecked] = useState<number[]>([]);
  const [finished, setFinished] = useState(false);

  /* Today's weekday (Baku), 1..7 — read post-mount, -1 until then.
   * todayIdx (0..5 Mon..Sat) drives the schedule table; the session
   * needs the raw weekday including Sunday. */
  const [weekday, setWeekday] = useState(-1);
  useEffect(() => {
    const dow = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "Asia/Baku" })
      .format(new Date());
    setWeekday(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(dow) + 1);
  }, []);

  const planSession = strings.sessions[activePlan] ?? {};
  const todays = weekday >= 1 && weekday <= 6 ? (planSession[weekday] ?? []) : [];

  /* Restore the day's saved progress: "YYYY-MM-DD|idx,idx" — a stale
   * date (yesterday's half-finished session) simply resets. */
  useEffect(() => {
    const raw = readStored(LS_SESSION + activePlan);
    const [date, list] = raw?.split("|") ?? ["", ""];
    setFinished(readStored(LS_DONE + activePlan) === bakuTodayStr());
    setChecked(date === bakuTodayStr() ? list.split(",").filter(Boolean).map(Number) : []);
  }, [activePlan]);

  const toggleChecked = (idx: number) => {
    setChecked((prev) => {
      const next = prev.includes(idx) ? prev.filter((x) => x !== idx) : [...prev, idx];
      store(LS_SESSION + activePlan, `${bakuTodayStr()}|${next.join(",")}`);
      return next;
    });
  };

  const allDone = todays.length > 0 && checked.length === todays.length;

  const finishSession = () => {
    setFinished(true);
    store(LS_DONE + activePlan, bakuTodayStr());
  };

  /* ── Change-plan dialog ── */
  const [picker, setPicker] = useState(false);
  const pick = (id: string) => {
    onSelectPlan(id);
    setPicker(false);
  };

  return (
    <>
      {session ? (
        /* ── The workout session — today's plan as a guided checklist ── */
        <section className="gsession" aria-label={planUi.sessionTitle}>
          <header className="gsession-head">
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => setSession(false)}
            >
              <ChevronLeft size={16} aria-hidden />{planUi.back}
            </button>
            <div>
              <p className="eyebrow"><i />{planUi.sessionTitle}</p>
              <h3 className="h4">
                {current.name}
                {weekday >= 1 && weekday <= 6 && strings.dayNames[weekday - 1]
                  ? ` · ${strings.dayNames[weekday - 1]}`
                  : ""}
              </h3>
            </div>
          </header>

          <div className="gsession-progress">
            <div
              className="gplan-bar"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={todays.length}
              aria-valuenow={checked.length}
              aria-label={fillSession(planUi.sessionProgressA11y, checked.length, todays.length)}
            >
              <i style={{ width: `${todays.length ? (checked.length / todays.length) * 100 : 0}%` }} />
            </div>
            <span className="gsession-count">
              {fillSession(planUi.sessionProgress, checked.length, todays.length)}
            </span>
          </div>

          {todays.length === 0 ? (
            <div className="gempty">
              <Trophy size={22} aria-hidden />
              <p><b>{planUi.restDay}</b></p>
            </div>
          ) : finished ? (
            <div className="gempty">
              <CheckCircle2 size={22} aria-hidden />
              <p><b>{planUi.finished}</b></p>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setSession(false)}>
                {planUi.back}
              </button>
            </div>
          ) : (
            <ol className="gsession-list">
              {todays.map((ex, i) => {
                const isDone = checked.includes(i);
                return (
                  <li key={`${ex.id}-${i}`} className="gex" data-done={isDone || undefined}>
                    <button
                      type="button"
                      className="gex-check"
                      aria-pressed={isDone}
                      onClick={() => toggleChecked(i)}
                    >
                      <span className="gex-num">{i + 1}</span>
                      <span className="gex-box" aria-hidden>
                        {isDone ? <CheckCircle2 size={20} /> : <span className="gex-circle" />}
                      </span>
                      <span className="sr-only">{planUi.done}</span>
                    </button>
                    <div className="gex-body">
                      <div className="gex-top">
                        <h4 className="h5">{ex.name}</h4>
                        <span className="tag">{ex.setsLabel}</span>
                      </div>
                      <p className="gex-target">{ex.target}</p>
                      <p className="gex-guide"><Info size={14} aria-hidden />{ex.guide}</p>
                      <p className="gex-rest">{ex.restLabel}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          {!finished && allDone && (
            <button type="button" className="btn gsession-finish" onClick={finishSession}>
              <Trophy size={16} aria-hidden />{planUi.finish}
            </button>
          )}
        </section>
      ) : (
        /* ── The active-plan hero ── */
        <section className="gplan" aria-label={planUi.activeEyebrow}>
          <div className="gplan-img">
            <img src={current.image} alt="" width={800} height={500} loading="lazy" decoding="async" />
          </div>
          <div className="gplan-body">
            <div className="card-top">
              <span className="tag">{current.level}</span>
              <span className="tag tag-solid">{planUi.activeTag}</span>
            </div>
            <h3>{current.name}</h3>
            <p>{current.desc}</p>
            <ul className="facts">
              {current.meta.map((m) => <li key={m}>{m}</li>)}
            </ul>
            <div className="gplan-progress">
              <div className="gplan-week">
                <b>{planUi.activeEyebrow}</b>
                <span>{current.weekLabel}</span>
              </div>
              <div
                className="gplan-bar"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={current.percent}
                aria-label={current.progressA11y}
              >
                <i style={{ width: `${current.percent}%` }} />
              </div>
              <div className="gplan-done">
                {finished ? (
                  <span className="gdone-pill">
                    <CheckCircle2 size={16} aria-hidden />{planUi.finished}
                  </span>
                ) : (
                  <button type="button" className="btn btn-sm gdone-btn" onClick={() => setSession(true)}>
                    <Dumbbell size={16} aria-hidden />{planUi.start}
                  </button>
                )}
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => setPicker(true)}>
                  {planUi.change}
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── The weekly schedule (stays on the plan tab) ── */}
      <section className="gpanel-blk" aria-label={planUi.scheduleEyebrow}>
        <h3 className="h4">{planUi.scheduleEyebrow}</h3>
        <div className="sched-clip">
          <div className="sched-wrap" tabIndex={0} role="region" aria-label={planUi.scheduleA11y}>
            <table className="sched">
              <thead>
                <tr>
                  <th scope="col">{planUi.timeCol}</th>
                  {schedule.days.map((d, i) => (
                    <th key={d} scope="col" data-today={i === todayIdx || undefined}>{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {schedule.slots.map((slot) => (
                  <tr key={slot.time}>
                    <th scope="row"><b>{slot.time}</b><span>{slot.label}</span></th>
                    {slot.cells.map((cell, i) => (
                      <td key={i} data-today={i === todayIdx || undefined}>
                        <span className="cell" data-kind={cell.kind}>{cell.label}</span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── "Planımı dəyişdir" — the plans catalog behind a dialog ── */}
      <div className="gplan-change">
        <button type="button" className="btn btn-quiet" onClick={() => setPicker(true)}>
          {planUi.change}
        </button>
      </div>

      <Modal
        open={picker}
        onClose={() => setPicker(false)}
        title={planUi.changeTitle}
        closeLabel={planUi.close}
        wide
      >
        <ul className="gshop-grid gpicker-grid">
          {plans.map((p) => (
            <li key={p.id} className="card" data-active={p.id === activePlan || undefined}>
              <span className="card-top">
                <span className="tag">{p.level}</span>
              </span>
              <h3 className="h4">{p.name}</h3>
              <p>{p.desc}</p>
              <ul className="facts">
                {p.meta.map((m) => <li key={m}>{m}</li>)}
              </ul>
              {p.id === activePlan ? (
                <span className="tag tag-solid gplan-chosen">{planUi.activeTag}</span>
              ) : (
                <button
                  type="button"
                  className="btn btn-sm btn-quiet gplan-choose"
                  onClick={() => pick(p.id)}
                >
                  {planUi.select}
                </button>
              )}
            </li>
          ))}
        </ul>
      </Modal>
    </>
  );
}

/* ── Zallar — compact cards + the "Ətraflı" details dialog ─────────────── */

function GymsPanel({ strings }: { strings: GymAppStrings }) {
  const { gyms, gymsUi } = strings;

  const [sort, setSort] = useState<"rating" | "price">("rating");
  const [active, setActive] = useState<string[]>([]);
  const [detail, setDetail] = useState<GymView | null>(null);

  /* Amenity chips are derived from the already-translated feature labels
   * — no extra data plumbed through, first-seen order. */
  const features = useMemo(
    () => Array.from(new Set(gyms.flatMap((g) => g.features))),
    [gyms],
  );

  /* Empty set = no filter; otherwise OR — a gym passes on any active chip. */
  const visible = active.length
    ? gyms.filter((g) => active.some((f) => g.features.includes(f)))
    : gyms;
  const ordered = [...visible].sort((a, b) =>
    sort === "rating" ? b.rating - a.rating : a.dayPrice - b.dayPrice,
  );

  const toggle = (f: string) =>
    setActive((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f],
    );

  return (
    <>
      <div className="gyms-bar">
        <div className="sort-seg" role="group" aria-label={strings.sortLabel}>
          <button type="button" aria-pressed={sort === "rating"} onClick={() => setSort("rating")}>
            {gymsUi.sortRating}
          </button>
          <button type="button" aria-pressed={sort === "price"} onClick={() => setSort("price")}>
            {gymsUi.sortPrice}
          </button>
        </div>
      </div>
      <ul className="gyms-chips" aria-label={gymsUi.filterLabel}>
        <li>
          <button
            type="button"
            className="chip-f"
            aria-pressed={active.length === 0}
            onClick={() => setActive([])}
          >
            {gymsUi.filterAll}
          </button>
        </li>
        {features.map((f) => (
          <li key={f}>
            <button
              type="button"
              className="chip-f"
              aria-pressed={active.includes(f)}
              onClick={() => toggle(f)}
            >
              {f}
            </button>
          </li>
        ))}
      </ul>
      {/* <output> carries an implicit status/polite live region. */}
      <output className="sr-only">
        {fillCount(strings.resultsA11y, ordered.length, gyms.length)}
      </output>
      {ordered.length === 0 ? (
        <div className="gempty">
          <SearchX size={22} aria-hidden />
          <p><b>{gymsUi.gymsNoResults}</b></p>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setActive([])}>
            {gymsUi.filterAll}
          </button>
        </div>
      ) : (
        /* The key replays the entrance stagger when the controls change —
         * the new order/selection arrives with the same card animation. */
        <ul className="gyms-grid" key={`${sort}|${active.join("|")}`}>
          {ordered.map((g, i) => (
            <li key={g.id} className="gplace" style={{ "--i": i } as CSSProperties}>
              <div className="gplace-img">
                <img src={g.image} alt="" width={800} height={533} loading="lazy" decoding="async" />
              </div>
              <div className="gplace-body">
                <div className="place-top">
                  <h3>{g.name}</h3>
                  <span className="score" role="img" aria-label={g.ratingA11y}>
                    <Star size={14} fill="currentColor" aria-hidden />{g.rating.toFixed(1)}
                  </span>
                </div>
                <p>{g.desc}</p>
                <div className="gplace-meta">
                  <span className="gplace-line">
                    <MapPin size={15} aria-hidden />{g.address}
                  </span>
                  <span className="gplace-line">
                    <span className="sr-only">{gymsUi.openHoursSr}: </span>
                    <Clock size={15} aria-hidden />{g.hours}
                  </span>
                </div>
                <div className="gplace-foot">
                  <span className="tag">{gymsUi.dayPass} · {g.dayPrice} ₼</span>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => setDetail(g)}
                  >
                    {gymsUi.details}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* ── The details dialog: hall info + full equipment + trainers ── */}
      <Modal
        open={detail !== null}
        onClose={() => setDetail(null)}
        title={detail?.name ?? ""}
        closeLabel={gymsUi.close}
        wide
      >
        {detail && (
          <div className="gdetail">
            <div className="gdetail-hero">
              <img src={detail.image} alt="" width={900} height={533} loading="lazy" decoding="async" />
              <div className="gdetail-info">
                <span className="score">
                  <Star size={14} fill="currentColor" aria-hidden />{detail.rating.toFixed(1)}
                </span>
                <span className="gplace-line"><MapPin size={15} aria-hidden />{detail.address}</span>
                <span className="gplace-line">
                  <span className="sr-only">{gymsUi.openHoursSr}: </span>
                  <Clock size={15} aria-hidden />{detail.hours}
                </span>
                <span className="tag">{gymsUi.dayPass} · {detail.dayPrice} ₼</span>
              </div>
            </div>

            <h3 className="h5">{gymsUi.aboutTitle}</h3>
            <p className="gdetail-desc">{detail.desc}</p>
            <ul className="chips">
              {detail.features.map((f) => <li key={f}>{f}</li>)}
            </ul>

            <h3 className="h5">{gymsUi.equipTitle}</h3>
            <ul className="gdetail-eq">
              {detail.equipment.map((eq) => <li key={eq}><Dumbbell size={14} aria-hidden />{eq}</li>)}
            </ul>

            <h3 className="h5">{gymsUi.trainersTitle}</h3>
            <ul className="gdetail-trainers">
              {detail.trainers.map((t) => (
                <li key={t.name}>
                  <b>{t.name}</b>
                  <span className="tag">{t.spec}</span>
                  <span className="gtrainer-years">{detail.trainerYears.replace("{count}", String(t.years))}</span>
                </li>
              ))}
            </ul>

            <a
              className="btn gdetail-cta"
              href={mapsUrl(detail.name)}
              target="_blank"
              rel="noopener noreferrer"
            >
              {gymsUi.mapsCta}<ArrowUpRight size={15} aria-hidden />
            </a>
          </div>
        )}
      </Modal>
    </>
  );
}

/* ── Shop directories (alətlər / əlavələr / aksesuarlar / geyim) ───────── */

function ShopPanel({
  tab, items, ui, sort, onSort, query, onQuery,
}: {
  tab: ShopTabId;
  items: ShopItemView[];
  ui: GymAppStrings;
  sort: ShopSort;
  onSort: (s: ShopSort) => void;
  /** Live search — shared across the shop tabs, reset on a tab switch. */
  query: string;
  onQuery: (q: string) => void;
}) {
  const catalog = items;

  const iconOf = (item: ShopItemView): LucideIcon =>
    catalog.find((p) => p.id === item.id) ? iconByName(item.icon) : Dumbbell;

  // Live search first (name / brand / any store), then the chosen sort.
  const q = query.trim().toLowerCase();
  const visible = q
    ? items.filter((it) =>
        it.name.toLowerCase().includes(q) ||
        it.brand.toLowerCase().includes(q) ||
        it.at.some((s) => s.name.toLowerCase().includes(q)))
    : items;
  // Cheap = ascending by the cheapest store price; popular = curated order.
  const ordered =
    sort === "cheap" ? [...visible].sort((a, b) => a.minPrice - b.minPrice) : visible;

  return (
    <>
      <p className="gshop-note"><Info size={15} aria-hidden />{ui.shopNote}</p>
      <div className="gshop-bar">
        <div className="sort-seg" role="group" aria-label={ui.sortLabel}>
          <button type="button" aria-pressed={sort === "popular"} onClick={() => onSort("popular")}>
            {ui.sortPopular}
          </button>
          <button type="button" aria-pressed={sort === "cheap"} onClick={() => onSort("cheap")}>
            {ui.sortCheap}
          </button>
        </div>
        <div className="gshop-search">
          <Search size={16} aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder={ui.searchPlaceholder}
            aria-label={ui.searchLabel}
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <button
              type="button"
              className="gsearch-clear"
              onClick={() => onQuery("")}
              aria-label={ui.searchClear}
            >
              <X size={15} aria-hidden />
            </button>
          )}
        </div>
      </div>
      {/* <output> carries an implicit status/polite live region. */}
      <output className="sr-only">
        {fillCount(ui.resultsA11y, ordered.length, items.length)}
      </output>
      {ordered.length === 0 ? (
        <div className="gempty">
          <SearchX size={22} aria-hidden />
          <p><b>{ui.noResults}</b></p>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => onQuery("")}>
            {ui.searchClear}
          </button>
        </div>
      ) : (
        /* The key replays the entrance stagger when the sort changes —
         * typing in the search box must NOT remount (focus lives in the
         * bar above; matches simply drop out of the still-mounted list). */
        <ul className="gshop-grid" key={`${tab}|${sort}`}>
          {ordered.map((item, i) => {
          const Icon = iconOf(item);
          return (
            <li
              key={item.id}
              className="gprod"
              style={{ "--i": i } as CSSProperties}
            >
              {item.image ? (
                <div className="gprod-img">
                  <img src={item.image} alt="" width={640} height={420} loading="lazy" decoding="async" />
                </div>
              ) : null}
              <div className="card-top">
                <span className="chip-ico tinted"><Icon size={20} aria-hidden /></span>
                <span className="tag">{item.priceLabel}</span>
              </div>
              <h3 className="h4">{item.name}</h3>
              <p className="gprod-brand">{item.brand}</p>
              <p className="gprod-count">{item.countLabel}</p>
              <p className="gprod-buy">{ui.whereToBuy}</p>
              <ul className="buy-list">
                {item.at.map((store, si) => (
                  <li key={store.name}>
                    <a
                      href={store.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-best={si === item.best || undefined}
                    >
                      <b>{store.name}</b>
                      <span className="buy-kind">{store.kind}</span>
                      <span className="buy-price">{store.price} ₼</span>
                      <ArrowUpRight size={14} aria-hidden />
                      {si === item.best && <span className="buy-best">{ui.bestPrice}</span>}
                    </a>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
        </ul>
      )}
    </>
  );
}
