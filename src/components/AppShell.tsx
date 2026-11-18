"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AudioLines, Backpack, BookOpen, Brain, CalendarDays, ChefHat,
  Circle, Dumbbell, Flower2, House, Landmark, Layers, LibraryBig, MapPin,
  MonitorPlay, NotebookPen, Pill, Salad, Shirt, Users, Wind,
  type LucideIcon,
} from "lucide-react";
import { Link } from "@/i18n/navigation";

/**
 * The registered-surface shell every section app sits in — v3, running the
 * TOP NAV'S system vertically:
 *
 * • the rail mirrors the nav pill's two states — at rest a full-bleed
 *   solid strip flush to the left edge (it merges into the page exactly
 *   like the nav does at the top), and past 24px of scroll the same
 *   floating frosted-glass capsule: margins appear, corners round,
 *   border + blur + shadow fade in.
 *
 * • Unlike the fixed nav, the rail is IN FLOW — when the page scrolls
 *   down, the rail scrolls down with it (no pinning, no internal sticky).
 *
 * • Tab size follows the subtab count (data-density): sections with few
 *   subtabs get roomy pills, crowded sections get compact ones so the
 *   stack always fits.
 *
 * Two modes:
 * • "link" — the tabs are routes (diet/meditation subpages); the active
 *   tab renders aria-current="page" and next-intl navigates.
 * • "tab" — the tabs switch panels in-page (the gym app); real
 *   tablist/tab semantics with aria-selected and roving arrows.
 *
 * Tabs arrive pre-translated from the server — icon is a registry key
 * (serializable across the RSC boundary) or a LucideIcon component when
 * the parent is itself a client component.
 */
const RAIL_ICONS: Record<string, LucideIcon> = {
  audio: AudioLines, backpack: Backpack, book: BookOpen, brain: Brain,
  calendar: CalendarDays, chef: ChefHat, dumbbell: Dumbbell, flower: Flower2,
  house: House, landmark: Landmark, layers: Layers, library: LibraryBig,
  mapPin: MapPin, notebook: NotebookPen, pill: Pill, salad: Salad,
  shirt: Shirt, users: Users, video: MonitorPlay, wind: Wind,
};

export type ShellTab = {
  id: string;
  /** Pre-translated label. */
  label: string;
  /** Registry key ("brain", "book"…) — unknown keys fall back to a dot. */
  icon: string | LucideIcon;
};

export type ShellUi = {
  /** aria-label for the rail nav. */
  label: string;
  open: string;
  close: string;
  /** "Current:" — screen-reader prefix before the active tab name. */
  current: string;
  /** The section's display name ("Diet", "Gym"…) — the small uppercase
   *  caption at the top of the sidebar capsule (lg+ only). */
  title?: string;
};

type Props = {
  mode: "link" | "tab";
  tabs: ShellTab[];
  activeId: string;
  /** link mode — tab id → route href (serializable, server-safe). */
  hrefs: Record<string, string>;
  /** tab mode — called after a tab button activates. */
  onSelect?: (id: string) => void;
  ui: ShellUi;
  /** Kept for API compatibility — the v2 rail no longer collapses. */
  storageKey?: string;
  children: ReactNode;
};

/* The section rail — the top nav's shrink system translated into a side
 * column on the site's token system: solid and flush at rest, a floating
 * frosted capsule once the page scrolls; on the site's own tokens, and in
 * page flow so it travels with the content. */

export function AppShell({
  mode, tabs, activeId, hrefs, onSelect, ui, children,
}: Props) {
  const listRef = useRef<HTMLUListElement>(null);
  const [scrolled, setScrolled] = useState(false);

  /* The same scroll signal the top nav uses (24px threshold): past it the
   * surfaces morph into floating frosted pills — the rail joins in. */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* Density: few subtabs → roomy pills, many → compact ones, so every
   * section's stack fits its column. (≤4 cozy · 5-6 regular · ≥7 compact) */
  const density = tabs.length >= 7 ? "compact" : tabs.length >= 5 ? "regular" : "cozy";

  /* Roving focus across the tab list: arrows walk it, Home/End jump.
   * Applies in tab mode (tablist semantics); link mode is plain
   * Tab-order navigation. */
  const onKeyDown = (e: React.KeyboardEvent<HTMLUListElement>) => {
    const list = listRef.current;
    if (!list) return;
    const items = Array.from(
      list.querySelectorAll<HTMLElement>(".app-tab"),
    );
    if (!items.length) return;
    const i = items.indexOf(document.activeElement as HTMLElement);
    const len = items.length;
    let next = -1;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") next = (i + 1) % len;
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") next = (i - 1 + len) % len;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = len - 1;
    if (next >= 0) {
      e.preventDefault();
      items[next]!.focus();
    }
  };

  const iconOf = (icon: ShellTab["icon"]): LucideIcon =>
    typeof icon !== "string" ? icon : (RAIL_ICONS[icon] ?? Circle);

  return (
    <div className="app-shell" data-scrolled={scrolled} data-density={density}>
      {/* ── The rail: the nav pill's system as a side column — solid
          full-bleed strip at rest, floating frosted capsule past 24px of
          scroll. In flow, so it scrolls down with the page. ── */}
      <nav className="app-rail" aria-label={ui.label}>
        <div className="app-rail-clip">
          {ui.title && <p className="app-rail-title">{ui.title}</p>}
          <ul
            className="app-tabs"
            ref={listRef}
            aria-label={ui.label}
            {...(mode === "tab"
              ? { role: "tablist" as const, onKeyDown }
              : {})}
          >
            {tabs.map((t) => {
              const Icon = iconOf(t.icon);
              const isActive = t.id === activeId;
              const srCurrent = isActive && mode === "link"
                ? <span className="sr-only">{ui.current} </span>
                : null;
              return (
                <li key={t.id}>
                  {mode === "link" ? (
                    <Link
                      href={hrefs[t.id] ?? "#"}
                      className="app-tab"
                      aria-current={isActive ? "page" : undefined}
                      title={t.label}
                      onClick={() => onSelect?.(t.id)}
                    >
                      <Icon size={18} aria-hidden />
                      <span className="label">{srCurrent}{t.label}</span>
                    </Link>
                  ) : (
                    <button
                      type="button"
                      role="tab"
                      className="app-tab"
                      aria-selected={isActive}
                      aria-controls="app-panel"
                      title={t.label}
                      onClick={() => onSelect?.(t.id)}
                    >
                      <Icon size={18} aria-hidden />
                      <span className="label">{srCurrent}{t.label}</span>
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      {/* ── The section's content — keeps its own .wrap centering ── */}
      <div className="app-main">{children}</div>
    </div>
  );
}
