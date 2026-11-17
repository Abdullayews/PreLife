"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  ArrowUpRight, ChevronDown, Clock, Info, MapPin, Menu, Star, Dumbbell,
  type LucideIcon,
} from "lucide-react";
import { hasConsent } from "@/lib/consent";
import {
  GYM_TABS, productsOf, isShopTab,
  type GymTabId, type ShopTabId,
} from "@/lib/gym";

/**
 * The registered-surface gym app: a collapsible left rail (the ☰ button
 * plus an indicator of the current subtab — tapping it opens/collapses
 * the choice list with an animation) and the active tab's panel on the
 * right. Six subtabs: plan, gyms and the four shop directories.
 *
 * v1.1 additions:
 * • full keyboard support — arrows/Home/End walk the tab list, Escape
 *   collapses the mobile dropdown, a scrim closes it on outside-tap;
 * • the last tab, active plan and desktop rail state persist to
 *   localStorage (consent-gated — without consent it stays in-session);
 *   a ?tab= deep link in the URL always beats the remembered tab;
 * • shop tabs: sort control (popular / by cheapest), an "best price"
 *   badge on each product's cheapest store row, a store-count line;
 * • the schedule highlights today's column (Baku wall clock, set after
 *   mount so server and client never disagree).
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
};

export type ShopItemView = {
  id: string;
  name: string;
  brand: string;
  priceLabel: string;
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
  currentTabSr: string;
  heads: Record<GymTabId, { eyebrow: string; title: string; lede: string }>;
  shopNote: string;
  whereToBuy: string;
  bestPrice: string;
  sortLabel: string;
  sortPopular: string;
  sortCheap: string;
  plans: PlanView[];
  planUi: {
    activeEyebrow: string;
    activeTag: string;
    select: string;
    plansEyebrow: string;
    switchHint: string;
    scheduleEyebrow: string;
    scheduleA11y: string;
    timeCol: string;
  };
  schedule: {
    days: string[];
    slots: { time: string; label: string; cells: { label: string; kind: number }[] }[];
  };
  gyms: GymView[];
  gymsUi: { dayPass: string; mapsCta: string; openHoursSr: string };
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
};

/* ── Shop ordering ─────────────────────────────────────────────────────── */

type ShopSort = "popular" | "cheap";

/* ── Persistence (consent-gated, in-session without it) ────────────────── */

const LS_TAB = "pl:gym:tab";
const LS_PLAN = "pl:gym:plan";
const LS_RAIL = "pl:gym:rail";

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

/** The dropdown-overlay shape exists only below lg (64rem). */
const isMobileView = () => window.matchMedia("(max-width: 63.99rem)").matches;

/** Today's schedule column in Baku wall time — Mon..Sat → 0..5, else -1.
 *  Called from an effect only, so SSR and hydration never disagree. */
const bakuToday = (): number => {
  const dow = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "Asia/Baku" })
    .format(new Date());
  return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(dow);
};

/* ── Shell ─────────────────────────────────────────────────────────────── */

export function GymApp({ initialTab, initialPlan, linked, strings }: Props) {
  const [tab, setTab] = useState<GymTabId>(initialTab);
  const [railOpen, setRailOpen] = useState(false);
  const [activePlan, setActivePlan] = useState(initialPlan);
  const [shopSort, setShopSort] = useState<ShopSort>("popular");
  const [todayIdx, setTodayIdx] = useState(-1);
  const tabListRef = useRef<HTMLUListElement>(null);

  /* Restore the last choices after mount (a deep link beats the remembered
   * tab; the rail state applies to the desktop sidebar shape only). */
  useEffect(() => {
    if (!linked) {
      const remembered = readStored(LS_TAB);
      if (remembered && GYM_TABS.some((x) => x.id === remembered)) {
        setTab(remembered as GymTabId);
      }
    }
    const plan = readStored(LS_PLAN);
    if (plan && strings.plans.some((p) => p.id === plan)) setActivePlan(plan);
    if (readStored(LS_RAIL) === "open" && !isMobileView()) setRailOpen(true);
    setTodayIdx(bakuToday());
  }, [linked, strings.plans]);

  /* Escape collapses the mobile dropdown (the desktop sidebar stays). */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isMobileView()) setRailOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
}, []);

  const selectTab = (id: GymTabId) => {
    setTab(id);
    store(LS_TAB, id);
    // Keep ?tab= in sync so the link is shareable / survives a refresh —
    // plain history.replaceState, no refetch, no scroll.
    window.history.replaceState(null, "", `?tab=${id}`);
    // Below lg the rail overlays the content — close it after a choice.
    if (isMobileView()) setRailOpen(false);
  };

  const choosePlan = (id: string) => {
    setActivePlan(id);
    store(LS_PLAN, id);
  };

  const toggleRail = () => {
    const next = !railOpen;
    setRailOpen(next);
    store(LS_RAIL, next ? "open" : "closed");
  };

  /* Roving focus across the tab list: arrows walk it, Home/End jump. */
  const onTabsKeyDown = (e: React.KeyboardEvent<HTMLUListElement>) => {
    const list = tabListRef.current;
    if (!list) return;
    const tabs = Array.from(list.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    if (!tabs.length) return;
    const i = tabs.indexOf(document.activeElement as HTMLButtonElement);
    const len = tabs.length;
    let next = -1;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") next = (i + 1) % len;
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") next = (i - 1 + len) % len;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = len - 1;
    if (next >= 0) {
      e.preventDefault();
      tabs[next]!.focus();
    }
  };

  const head = strings.heads[tab];

  return (
    <>
      {/* Below lg an open rail overlays the page — this scrim closes it on
          an outside tap. Fixed, out-of-flow, hidden entirely at lg+. */}
      {railOpen && (
        <div className="gym-scrim" onPointerDown={() => setRailOpen(false)} aria-hidden="true" />
      )}

      <div className="gym-layout" data-rail={railOpen ? "open" : "closed"}>
        {/* ── Left rail: ☰ + current-subtab indicator, tap to open/collapse ── */}
        <nav className="gym-rail" data-open={railOpen} aria-label={strings.railLabel}>
          <button
            type="button"
            className="gym-rail-head"
            aria-expanded={railOpen}
            aria-controls="gym-tab-list"
            aria-label={railOpen ? strings.railClose : strings.railOpen}
            onClick={toggleRail}
          >
            <Menu size={20} aria-hidden />
            <span className="gym-rail-now">
              <span className="sr-only">{strings.currentTabSr} </span>
              {strings.tabs[tab]}
            </span>
            <ChevronDown size={17} className="chev" aria-hidden />
          </button>
          <div className="gym-rail-list" id="gym-tab-list">
            <div className="gym-rail-clip">
              <ul
                className="gym-tabs"
                role="tablist"
                aria-label={strings.railLabel}
                ref={tabListRef}
                onKeyDown={onTabsKeyDown}
              >
                {GYM_TABS.map(({ id, icon: Icon }) => (
                  <li key={id}>
                    <button
                      type="button"
                      role="tab"
                      className="gym-tab"
                      aria-selected={tab === id}
                      aria-controls="gym-panel"
                      title={strings.tabs[id]}
                      onClick={() => selectTab(id)}
                    >
                      <Icon size={19} aria-hidden />
                      <span className="label">{strings.tabs[id]}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </nav>

        {/* ── Right: the active subtab's content ── */}
        <div className="gym-body">
          <div
            key={tab === "plan" ? `plan-${activePlan}` : tab}
            className="gym-panel"
            role="tabpanel"
            id="gym-panel"
            aria-label={strings.tabs[tab]}
          >
            <header className="gym-panel-head">
              <p className="eyebrow"><i />{head.eyebrow}</p>
              <h2 className="h3">{head.title}</h2>
              <p className="lede-panel">{head.lede}</p>
            </header>

            {tab === "plan" && (
              <PlanPanel
                strings={strings}
                activePlan={activePlan}
                todayIdx={todayIdx}
                onSelectPlan={choosePlan}
              />
            )}
            {tab === "gyms" && <GymsPanel gyms={strings.gyms} ui={strings.gymsUi} />}
            {isShopTab(tab) && (
              <ShopPanel
                tab={tab}
                items={strings.shops[tab]}
                ui={strings}
                sort={shopSort}
                onSort={setShopSort}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Idman planı ───────────────────────────────────────────────────────── */

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

  return (
    <>
      {/* Active plan hero — remounts (bar re-animates) on every switch. */}
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
            <p className="gplan-hint">{planUi.switchHint}</p>
          </div>
        </div>
      </section>

      <section className="gpanel-blk" aria-label={planUi.plansEyebrow}>
        <h3 className="h4">{planUi.plansEyebrow}</h3>
        <ul className="gshop-grid">
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
                  onClick={() => onSelectPlan(p.id)}
                >
                  {planUi.select}
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

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
    </>
  );
}

/* ── Zallar ────────────────────────────────────────────────────────────── */

function GymsPanel({ gyms, ui }: { gyms: GymView[]; ui: GymAppStrings["gymsUi"] }) {
  return (
    <ul className="gyms-grid">
      {gyms.map((g) => (
        <li key={g.id} className="gplace">
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
            <ul className="chips">
              {g.features.map((f) => <li key={f}>{f}</li>)}
            </ul>
            <div className="gplace-meta">
              <span className="gplace-line">
                <MapPin size={15} aria-hidden />{g.address}
              </span>
              <span className="gplace-line">
                <span className="sr-only">{ui.openHoursSr}: </span>
                <Clock size={15} aria-hidden />{g.hours}
              </span>
            </div>
            <div className="gplace-foot">
              <span className="tag">{ui.dayPass} · {g.dayPrice} ₼</span>
              <a
                className="btn btn-sm btn-ghost"
                href={mapsUrl(g.name)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {ui.mapsCta}<ArrowUpRight size={15} aria-hidden />
              </a>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ── Shop directories (alətlər / əlavələr / aksesuarlar / geyim) ───────── */

function ShopPanel({
  tab, items, ui, sort, onSort,
}: {
  tab: ShopTabId;
  items: ShopItemView[];
  ui: GymAppStrings;
  sort: ShopSort;
  onSort: (s: ShopSort) => void;
}) {
  const catalog = productsOf(tab);

  const iconOf = (id: string): LucideIcon =>
    catalog.find((p) => p.id === id)?.icon ?? Dumbbell;

  // Cheap = ascending by the cheapest store price; popular = curated order.
  const ordered =
    sort === "cheap" ? [...items].sort((a, b) => a.minPrice - b.minPrice) : items;

  return (
    <>
      <p className="gshop-note"><Info size={15} aria-hidden />{ui.shopNote}</p>
      <div className="gshop-bar" role="group" aria-label={ui.sortLabel}>
        <div className="sort-seg">
          <button type="button" aria-pressed={sort === "popular"} onClick={() => onSort("popular")}>
            {ui.sortPopular}
          </button>
          <button type="button" aria-pressed={sort === "cheap"} onClick={() => onSort("cheap")}>
            {ui.sortCheap}
          </button>
        </div>
      </div>
      <ul className="gshop-grid">
        {ordered.map((item, i) => {
          const Icon = iconOf(item.id);
          return (
            <li
              key={item.id}
              className="gprod"
              style={{ "--i": i } as CSSProperties}
            >
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
    </>
  );
}
