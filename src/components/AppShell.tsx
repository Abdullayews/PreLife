"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AudioLines, Backpack, BookOpen, Brain, CalendarDays, ChevronDown,
  Circle, Dumbbell, Flower2, House, Landmark, Layers, LibraryBig, MapPin,
  Menu, NotebookPen, Pill, Shirt, Users, Wind,
  type LucideIcon,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { hasConsent } from "@/lib/consent";

/**
 * The registered-surface shell every section app sits in: a ☰ rail with
 * the current-subtab indicator pinned to the LEFT EDGE of the viewport
 * (below the top nav, full height, hairline seam) and the section's
 * content to its right. Below 64rem the rail collapses into a bar and
 * the choice list drops down over a scrim — the exact pattern the gym
 * app pioneered in v1, generalized for every user surface.
 *
 * Two modes:
 * • "link" — the tabs are routes (diet subpages, ?tab= deep links);
 *   the active tab renders aria-current="page" and next-intl navigates.
 * • "tab" — the tabs switch panels in-page (the gym app); real
 *   tablist/tab semantics with aria-selected.
 *
 * Tabs arrive pre-translated from the server — icon is a registry key
 * (serializable across the RSC boundary) or a LucideIcon component when
 * the parent is itself a client component.
 *
 * The rail's open/closed state persists to localStorage (consent-gated);
 * below lg an open rail overlays the page, so a scrim and Escape close it.
 */
const RAIL_ICONS: Record<string, LucideIcon> = {
  audio: AudioLines, backpack: Backpack, book: BookOpen, brain: Brain,
  calendar: CalendarDays, dumbbell: Dumbbell, flower: Flower2,
  house: House, landmark: Landmark, layers: Layers, library: LibraryBig,
  mapPin: MapPin, notebook: NotebookPen, pill: Pill, shirt: Shirt,
  users: Users, wind: Wind,
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
  /** localStorage key for the desktop open/closed memory. */
  storageKey: string;
  children: ReactNode;
};

/** The dropdown-overlay shape exists only below lg (64rem). */
const isMobileView = () => window.matchMedia("(max-width: 63.99rem)").matches;

const readStored = (key: string): string | null => {
  if (!hasConsent()) return null;
  try { return localStorage.getItem(key); } catch { return null; }
};

const store = (key: string, value: string): void => {
  if (!hasConsent()) return;
  try { localStorage.setItem(key, value); } catch { /* private mode */ }
};

export function AppShell({
  mode, tabs, activeId, hrefs, onSelect, ui, storageKey, children,
}: Props) {
  const [open, setOpen] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);
  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];

  /* Restore the desktop rail shape after mount (the mobile bar always
   * starts closed — an open overlay on load would cover the content). */
  useEffect(() => {
    if (readStored(storageKey) === "open" && !isMobileView()) setOpen(true);
  }, [storageKey]);

  /* Escape collapses the mobile dropdown (the desktop sidebar stays). */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isMobileView()) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    store(storageKey, next ? "open" : "closed");
  };

  /* Choosing a tab/link below lg closes the overlay; desktop stays. */
  const choose = (id: string) => {
    if (isMobileView()) setOpen(false);
    onSelect?.(id);
  };

  /* Roving focus across the tab list: arrows walk it, Home/End jump. */
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
    <>
      {/* Below lg an open rail overlays the page — this scrim closes it
          on an outside tap. Fixed, out-of-flow, hidden entirely at lg+. */}
      {open && (
        <div className="app-scrim" onPointerDown={() => setOpen(false)} aria-hidden="true" />
      )}

      <div className="app-shell" data-rail={open ? "open" : "closed"}>
        {/* ── The rail: ☰ + current-subtab indicator, tap to open/collapse ── */}
        <nav className="app-rail" data-open={open} aria-label={ui.label}>
          <button
            type="button"
            className="app-rail-head"
            aria-expanded={open}
            aria-controls="app-tab-list"
            aria-label={open ? ui.close : ui.open}
            onClick={toggle}
          >
            <Menu size={20} aria-hidden />
            <span className="app-rail-now">
              <span className="sr-only">{ui.current} </span>
              {active?.label}
            </span>
            <ChevronDown size={17} className="chev" aria-hidden />
          </button>
          <div className="app-rail-list" id="app-tab-list">
            <div className="app-rail-clip">
              <ul
                className="app-tabs"
                ref={listRef}
                aria-label={ui.label}
                /* Roving arrows only where the tablist pattern expects them
                 * (tab mode); the link list is plain Tab-order navigation. */
                {...(mode === "tab"
                  ? { role: "tablist" as const, onKeyDown }
                  : {})}
              >
                {tabs.map((t) => {
                  const Icon = iconOf(t.icon);
                  return (
                    <li key={t.id}>
                      {mode === "link" ? (
                        <Link
                          href={hrefs[t.id] ?? "#"}
                          className="app-tab"
                          aria-current={t.id === activeId ? "page" : undefined}
                          title={t.label}
                          onClick={() => choose(t.id)}
                        >
                          <Icon size={19} aria-hidden />
                          <span className="label">{t.label}</span>
                        </Link>
                      ) : (
                        <button
                          type="button"
                          role="tab"
                          className="app-tab"
                          aria-selected={t.id === activeId}
                          aria-controls="app-panel"
                          title={t.label}
                          onClick={() => choose(t.id)}
                        >
                          <Icon size={19} aria-hidden />
                          <span className="label">{t.label}</span>
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </nav>

        {/* ── The section's content — keeps its own .wrap centering ── */}
        <div className="app-main">{children}</div>
      </div>
    </>
  );
}
