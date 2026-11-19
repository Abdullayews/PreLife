"use client";

import {
  useCallback, useEffect, useMemo, useRef, useState,
  useSyncExternalStore,
  type CSSProperties, type ReactNode,
} from "react";
import {
  Brain, BookOpen, CalendarDays, ChevronsUpDown, Clock, Crown,
  Dumbbell, House, MapPin, Moon, Pill, Play, Salad, Search, SearchX,
  Settings, Shirt, Star, Sun, X,
  type LucideIcon,
} from "lucide-react";
import {
  DAY_NAMES, DAY_SHORT, EQ_LABELS, EXERCISES, FILTER_GROUPS, HALLS,
  IDMAN_TABS, PLANS, STORES, STORE_KIND_LABEL, TAB_HEADS, UI,
  WORKOUTS, isIdmanTabId, minPriceOf, minutesOf, muscleGroupsOf,
  nextWorkoutDay, productsOf, repsLabel, totalSetsOf, workoutFor,
  type Hall, type IdmanTabId, type PlannedExercise, type Product,
  type WorkoutDay,
} from "./data";

/**
 * İdman v3 — the redesigned gym surface.
 *
 * Layout: a collapsible glass sidebar (the "menu" module) with the İdman
 * group (plan · qida əlavələri · aksesuarlar · zallar · alətlər) plus the
 * other PreLife sections, and a main column that hosts one of five panels:
 *
 *  • plan — today's session: a STICKY summary panel (the day's overall
 *    plan: muscle groups, exercise list with sets × reps, total volume)
 *    beside the day's exercise cards (sets/reps prescription, a real demo
 *    video, the how-to guide and a completion toggle each).
 *  • supplements / accessories / equipment — search + filter-chip + sort
 *    catalogs on a 4-column grid (equipment carries a real video per item).
 *  • gyms — hall cards: info & location on top, trainers below, then the
 *    hall's equipment floor.
 *
 * Self-contained by design: embedded data (./data.ts), its own CSS
 * (the "İdman v3" block in globals.css), zero app imports — the same file
 * runs inside PreLife (/[locale]/gym) and in standalone demos.
 */

/* ── Props ──────────────────────────────────────────────────────────────── */

export type IdmanLinks = {
  home?: string; diet?: string; meditation?: string; library?: string; settings?: string;
};

export type IdmanAppProps = {
  user: { name: string; email?: string | null };
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

function PlanPanel() {
  const [planId, setPlanId] = useState<string>(
    () => PLANS.find((p) => p.featured)?.id ?? PLANS[0]!.id,
  );
  const plan = PLANS.find((p) => p.id === planId) ?? PLANS[0]!;

  const [weekday, setWeekday] = useState<number | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const doneKey = useRef<string>("");

  /* "Today" once, client-side (Baku), deferred a frame so the first
   * paint stays hydration-safe (the server cannot know the date). */
  useEffect(() => {
    const id = requestAnimationFrame(() => setWeekday(new Date().getDay()));
    return () => cancelAnimationFrame(id);
  }, []);

  const session: WorkoutDay | null = useMemo(
    () => (weekday === null ? null : workoutFor(planId, weekday)),
    [planId, weekday],
  );
  const isToday = session !== null;
  const preview: WorkoutDay = useMemo(
    () => nextWorkoutDay(planId, weekday === null ? 1 : (weekday === 0 ? 1 : weekday)),
    [planId, weekday],
  );
  const day = session ?? preview;

  /* Completion state — per plan + day + date, consent-gated, read a
   * frame after mount (storage is browser-only). */
  useEffect(() => {
    const key = `pl:idman:done:${planId}:${day.day}:${bakuToday()}`;
    const id = requestAnimationFrame(() => {
      doneKey.current = key;
      const raw = storeGet(key);
      setDone(new Set(raw ? (JSON.parse(raw) as string[]).filter(Boolean) : []));
    });
    return () => cancelAnimationFrame(id);
  }, [planId, day.day]);

  const toggleDone = (code: string) => {
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      storeSet(doneKey.current, JSON.stringify([...next]));
      return next;
    });
  };

  const total = day.exercises.length;
  const doneCount = day.exercises.filter((pe) => done.has(pe.ex)).length;
  const allDone = total > 0 && doneCount === total;
  const groups = muscleGroupsOf(day);
  const minutes = minutesOf(day);
  const sets = totalSetsOf(day);

  return (
    <div className="iplan">
      {/* Active plan header */}
      <div className="iplan-hero">
        <img className="iplan-hero-img" src={plan.image} alt="" width={640} height={360} loading="lazy" decoding="async" />
        <div className="iplan-hero-body">
          <p className="iplan-eyebrow"><span className="iplan-eyebrow-i" aria-hidden />{UI.activeEyebrow}</p>
          <h2 className="iplan-hero-title">{plan.name}</h2>
          <p className="iplan-hero-desc">{plan.desc}</p>
          <div className="iplan-hero-meta">
            <span className="itag itag-solid">{plan.level}</span>
            <span className="itag">{fill(UI.weekLabel, plan.week, plan.total)}</span>
            <span className="itag">{WORKOUTS[planId]?.length ?? 0} gün / həftə</span>
          </div>
          <div
            className="iplan-bar"
            role="progressbar"
            aria-valuenow={Math.round((plan.week / plan.total) * 100)}
            aria-valuemin={0} aria-valuemax={100}
            aria-label={fill(UI.weekLabel, plan.week, plan.total)}
          >
            <i style={{ width: `${Math.round((plan.week / plan.total) * 100)}%` }} />
          </div>
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
              {DAY_NAMES[isToday ? (weekday ?? 1) : day.day] ?? ""}
            </p>

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
              {day.exercises.map((pe, i) => {
                const ex = EXERCISES[pe.ex]!;
                return (
                  <li key={pe.ex} className={done.has(pe.ex) ? "done" : undefined}>
                    <span className="iplan-list-n" aria-hidden>{i + 1}</span>
                    <span className="iplan-list-name">{ex.name}</span>
                    <span className="iplan-list-dose">{pe.sets} × {repsLabel(pe.reps)}</span>
                  </li>
                );
              })}
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
              {UI.restDay} — {UI.nextSession}: <b>{DAY_NAMES[day.day]}</b>
            </p>
          )}
          <ul className="iex-grid">
            {day.exercises.map((pe, i) => (
              <ExerciseCard
                key={pe.ex}
                index={i}
                pe={pe}
                done={done.has(pe.ex)}
                onToggle={() => toggleDone(pe.ex)}
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
            const has = workoutFor(planId, d) !== null;
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

      {/* All plans */}
      <section className="iplan-plans" aria-label={UI.plansEyebrow}>
        <p className="iplan-side-sub">{UI.plansEyebrow}</p>
        <ul className="iplan-plan-grid">
          {PLANS.map((p) => (
            <li key={p.id} className={`iplan-plan${p.id === planId ? " active" : ""}`}>
              <img src={p.image} alt="" width={480} height={270} loading="lazy" decoding="async" />
              <div className="iplan-plan-body">
                <div className="iplan-plan-top">
                  <h3>{p.name}</h3>
                  {p.id === planId
                    ? <span className="itag itag-solid">{UI.activeTag}</span>
                    : <span className="itag">{p.level}</span>}
                </div>
                <p>{p.desc}</p>
                <button
                  type="button"
                  className="ibtn ibtn-sm"
                  disabled={p.id === planId}
                  onClick={() => setPlanId(p.id)}
                >
                  {UI.select}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function ExerciseCard({
  index, pe, done, onToggle,
}: {
  index: number; pe: PlannedExercise; done: boolean; onToggle: () => void;
}) {
  const ex = EXERCISES[pe.ex]!;
  const [open, setOpen] = useState(false);
  return (
    <li className={`iex${done ? " done" : ""}`}>
      <div className="iex-media">
        <VideoTile src={ex.video} label={`${ex.name} — demo video`} tall />
        <span className="iex-n" aria-hidden>{index + 1}</span>
      </div>
      <div className="iex-body">
        <div className="iex-top">
          <h3 className="iex-name">{ex.name}</h3>
          <span className="iex-dose">{pe.sets} × {repsLabel(pe.reps)}</span>
        </div>
        <p className="iex-target">{ex.target}</p>
        <p className="iex-rest">
          <Clock size={14} aria-hidden />
          {pe.rest > 0 ? fill(UI.restLabel, pe.rest) : UI.flowLine}
        </p>
        <details className="iex-guide" open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
          <summary>{UI.howTo}</summary>
          <p>{ex.guide}</p>
        </details>
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
  const initial = (user.name || "S").charAt(0).toLocaleUpperCase("az");

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
