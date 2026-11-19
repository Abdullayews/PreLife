"use client";

import {
  useEffect, useRef, useState, useSyncExternalStore, type ReactNode,
} from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  AudioLines, Backpack, BookOpen, Brain, CalendarDays, ChefHat, ChevronsUpDown,
  Circle, CircleHelp, Crown, Dumbbell, FileText, Flower2, House, Landmark, Layers,
  LibraryBig, LogOut, MapPin, Menu, MonitorPlay, Moon, NotebookPen, Pill,
  Salad, ScrollText, Settings, Shirt, Sun, UserRound, Users, Wind,
  type LucideIcon,
} from "lucide-react";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { sections } from "@/lib/shell";
import { apiUrl } from "@/lib/api-url";
import { hasConsent, setThemeChoice } from "@/lib/consent";
import { saveUserPref } from "@/lib/user-prefs";

/**
 * AppShell v5 — the İdman glass rail, global for every logged-in page.
 *
 * The v2.2 flat management panel is restyled (and re-architected on mobile)
 * after the İdman v3 design the team shipped for the gym surface — now the
 * ONE design language for the registered-user app:
 *
 * • GLASS — backdrop blur(22px) saturate(1.6), 28px radius, 82% surface,
 *   inset highlight — a floating card, not a strip.
 * • TWO WIDTHS — fully open (labels + one-line descriptions) or icon-only
 *   (4.75rem), switched by the fold button beside the brand, remembered
 *   post-consent. The grid column animates .45s.
 * • STICKY — on lg+ the card follows the reader down the page and scrolls
 *   internally when the stack outgrows the viewport.
 * • NO TOP NAV for signed-in users (v2.2): the rail carries the brand,
 *   identity, navigation, management, preferences and log out. When the
 *   offsets honest.
 * • NESTED SUBTABS — the current section's row becomes the group head
 *   (caret, collapsible); its subtabs nest underneath (link mode = real
 *   routes, tab mode = in-page tablist), exactly like the İdman group.
 * • MOBILE — the rail becomes the İdman overlay: floating glass panel +
 *   scrim + bottom-left FAB, Escape closes, routes close.
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
  /** The section's display name — the nested group's aria-label. */
  title?: string;
};

export type ShellUser = { name: string | null; email: string };

type Props = {
  mode: "link" | "tab";
  tabs: ShellTab[];
  activeId: string;
  /** link mode — tab id → route href (serializable, server-safe). */
  hrefs: Record<string, string>;
  /** tab mode — called after a tab button activates. */
  onSelect?: (id: string) => void;
  ui: ShellUi;
  /** The signed-in account — when present the management groups render. */
  user?: ShellUser | null;
  /** Whether the TOP nav renders for this visit. Derived from `user`
   *  (no session → the Nav shows) unless the page knows better (some
   *  surfaces render the rail while the guest
   *  Nav stays on screen). */
  topnav?: boolean;
  children: ReactNode;
};

/** Where the fold choice is remembered (only after cookie consent). */
const FOLD_KEY = "pl_rail_fold";

/* The live breakpoint — an external store, no effect state dance. */
const MOBILE_MQ = "(max-width: 63.9rem)";
const subscribeMobile = (cb: () => void) => {
  const mq = window.matchMedia(MOBILE_MQ);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const getMobileSnapshot = () => window.matchMedia(MOBILE_MQ).matches;
const getMobileServer = () => false;

export function AppShell({
  mode, tabs, activeId, hrefs, onSelect, ui, user, topnav, children,
}: Props) {
  const listRef = useRef<HTMLUListElement>(null);
  const [folded, setFolded] = useState(false);
  const [mobOpen, setMobOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(true);
  const [busy, setBusy] = useState(false);

  const t = useTranslations("sidePanel");
  const th = useTranslations("welcomePage");
  const ts = useTranslations("sections");
  const ta = useTranslations("accountMenu");
  const tm = useTranslations("moduleCommon");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  const mobile = useSyncExternalStore(subscribeMobile, getMobileSnapshot, getMobileServer);
  const expanded = mobile ? mobOpen : !folded;

  /* The stored fold choice returns post-consent; otherwise the rail starts
   * fully open (and stays in memory only). */
  useEffect(() => {
    if (!hasConsent()) return;
    try {
      if (localStorage.getItem(FOLD_KEY) === "1") setFolded(true);
    } catch { /* storage unavailable */ }
  }, []);

  /* Overlay hygiene: a route change closes the mobile drawer. */
  useEffect(() => { setMobOpen(false); }, [pathname]);

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
    setFolded((v) => {
      const next = !v;
      if (hasConsent()) {
        try { localStorage.setItem(FOLD_KEY, next ? "1" : "0"); } catch { /* ignore */ }
      }
      return next;
    });
  };

  /* Roving focus across the subtab list (tab mode). */
  const onKeyDown = (e: React.KeyboardEvent<HTMLUListElement>) => {
    const list = listRef.current;
    if (!list) return;
    const items = Array.from(list.querySelectorAll<HTMLElement>(".rail-tab"));
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

  const on = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  /* Main pages — Home first, the four sections, Subscription last. */
  const mainNav: { href: string; label: string; icon: LucideIcon; desc: string }[] = [
    { href: "/home", label: th("tabs.home"), icon: House, desc: t("desc.home") },
    ...sections.map((s) => ({
      href: s.href as string, label: ts(`${s.id}.name`), icon: s.icon, desc: t(`desc.${s.id}`),
    })),
    { href: "/subscription", label: th("header.drawerSubscription"), icon: Crown, desc: t("desc.subscription") },
  ];

  /* Management links — the old top-right dropdown, now panel rows. */
  const manageNav = [
    { href: "/profile", label: ta("profile"), icon: UserRound },
    { href: "/settings", label: ta("settings"), icon: Settings },
    { href: "/help", label: ta("help"), icon: CircleHelp },
    { href: "/terms", label: ta("terms"), icon: FileText },
    { href: "/rules", label: ta("rules"), icon: ScrollText },
  ] as const;

  const initials =
    user && (user.name?.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("") ??
      user.email.slice(0, 2)).toUpperCase();

  /* The section whose row becomes the nested group head (when the page
   * carries subtabs): the current section, matched by route prefix. The
   * row keeps ITS position in the list — only its markup changes (v5.1:
   * the order never shuffles; Home stays first). */
  const groupHref = tabs.length > 0
    ? mainNav.find(({ href }) => on(href))?.href
    : undefined;

  const logout = async () => {
    setBusy(true);
    try {
      await fetch(apiUrl("/api/auth/logout"), { method: "POST" });
      router.replace("/welcome");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const switchLocale = (loc: string) => {
    router.replace(pathname, { locale: loc });
    if (hasConsent()) {
      document.cookie = `NEXT_LOCALE=${loc}; path=/; max-age=31536000; samesite=lax`;
    }
    if (user) saveUserPref({ locale: loc });
  };

  const toggleTheme = () => {
    const dark = document.documentElement.classList.toggle("dark");
    setThemeChoice(dark);
    if (user) saveUserPref({ theme: dark ? "dark" : "light" });
  };

  const ariaCurrent = (href: string) =>
    on(href) ? ("page" as const) : undefined;

  /* A main-nav row (icon + label + one-line description). */
  const row = ({
    href, label, icon: Icon, desc,
  }: { href: string; label: string; icon: LucideIcon; desc?: string },
  ) => (
    <li key={href}>
      <Link
        href={href}
        className={`rail-item${on(href) ? " active" : ""}`}
        aria-current={ariaCurrent(href)}
        title={!expanded ? label : undefined}
      >
        <span className="rail-ic" aria-hidden><Icon size={19} strokeWidth={2} /></span>
        {expanded && (
          <span className="ri-meta">
            <span className="ri-label">{label}</span>
            {desc && <span className="ri-desc">{desc}</span>}
          </span>
        )}
      </Link>
    </li>
  );

  /* The current section's nested subtab group (İdman semantics: the row
   * becomes a collapsible head; the rail expands first when folded) —
   * rendered IN PLACE inside the main-nav map below. */

  const onGroupClick = () => {
    if (!expanded) {
      if (mobile) setMobOpen(true);
      else setFolded(false);
      return;
    }
    setGroupOpen((v) => !v);
  };

  return (
    <div
      className="app-shell"
      data-open={expanded ? "open" : "closed"}
      data-topnav={topnav ?? !user ? "on" : "off"}
      data-hassub={tabs.length > 0 ? "true" : "false"}
    >
      {/* Mobile scrim */}
      {mobile && expanded && (
        <button
          type="button"
          className="rail-scrim"
          aria-label={t("collapse")}
          onClick={() => setMobOpen(false)}
        />
      )}

      {/* ── The glass rail ── */}
      <nav className="app-rail" aria-label={user ? t("navLabel") : ui.label}>
        <div className="rail-top">
          <Link href={user ? "/home" : "/welcome"} aria-label={tm("navHome")} className="rail-brand">
            <span className="rail-brand-ic" aria-hidden><Dumbbell size={19} strokeWidth={2.2} /></span>
            {expanded && <span className="rail-brand-txt">Pre<em>Life</em></span>}
          </Link>
          <button
            type="button"
            className="rail-fold"
            onClick={toggleRail}
            aria-label={expanded ? t("collapse") : t("expand")}
            aria-expanded={expanded}
          >
            <ChevronsUpDown size={16} aria-hidden />
          </button>
        </div>

        <div className="app-rail-clip">
          {/* Identity */}
          {user && (
            <div className="rail-id">
              <span className="rail-avatar" aria-hidden>{initials}</span>
              {expanded && (
                <span className="rail-id-meta">
                  <b>{user.name ?? user.email}</b>
                  <span>{user.email}</span>
                </span>
              )}
            </div>
          )}

          <p className="rail-cap" aria-hidden>{t("mainCaption")}</p>
          <ul className="rail-list">
            {/* Main pages in their FIXED order — Home first, the four
                sections, Subscription last. When the page carries subtabs,
                that section's row becomes the nested group head IN PLACE
                (v5.1: the order never shuffles — Home stays first). */}
            {mainNav.map((item) => {
              if (item.href !== groupHref) return row(item);
              return (
                <li className="rail-group" key={item.href}>
                  <button
                    type="button"
                    className={`rail-item rail-group-head${on(item.href) ? " active" : ""}`}
                    onClick={onGroupClick}
                    aria-expanded={groupOpen}
                    title={!expanded ? item.label : undefined}
                  >
                    <span className="rail-ic" aria-hidden>
                      <item.icon size={19} strokeWidth={2} />
                    </span>
                    {expanded && (
                      <>
                        <span className="ri-meta">
                          <span className="ri-label">{item.label}</span>
                        </span>
                        <ChevronsUpDown
                          size={14} aria-hidden
                          className="rail-caret"
                          style={{ transform: groupOpen ? "rotate(180deg)" : "none" }}
                        />
                      </>
                    )}
                  </button>
                  <div className={`rail-sub${groupOpen && expanded ? " open" : ""}`}>
                    <ul
                      aria-label={ui.title ?? ui.label}
                      ref={listRef}
                      {...(mode === "tab"
                        ? { role: "tablist" as const, onKeyDown }
                        : {})}
                    >
                      {tabs.map((tab) => {
                        const Icon = iconOf(tab.icon);
                        const isActive = tab.id === activeId;
                        const srCurrent = isActive && mode === "link"
                          ? <span className="sr-only">{ui.current} </span>
                          : null;
                        return (
                          <li key={tab.id}>
                            {mode === "link" ? (
                              <Link
                                href={hrefs[tab.id] ?? "#"}
                                className={`rail-tab${isActive ? " active" : ""}`}
                                aria-current={isActive ? "page" : undefined}
                                title={!expanded ? tab.label : undefined}
                                onClick={() => onSelect?.(tab.id)}
                              >
                                <span className="rail-ic" aria-hidden><Icon size={18} strokeWidth={2} /></span>
                                {expanded && <span className="label">{srCurrent}{tab.label}</span>}
                              </Link>
                            ) : (
                              <button
                                type="button"
                                role="tab"
                                className={`rail-tab${isActive ? " active" : ""}`}
                                aria-selected={isActive}
                                aria-controls="app-panel"
                                title={!expanded ? tab.label : undefined}
                                onClick={() => onSelect?.(tab.id)}
                              >
                                <span className="rail-ic" aria-hidden><Icon size={18} strokeWidth={2} /></span>
                                {expanded && <span className="label">{srCurrent}{tab.label}</span>}
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Management (signed in) */}
          {user && (
            <>
              <p className="rail-cap" aria-hidden>{t("manageCaption")}</p>
              <ul className="rail-list">
                {manageNav.map(({ href, label, icon: Icon }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className={`rail-item${on(href) ? " active" : ""}`}
                      aria-current={ariaCurrent(href)}
                      title={!expanded ? label : undefined}
                    >
                      <span className="rail-ic" aria-hidden><Icon size={19} strokeWidth={2} /></span>
                      {expanded && (
                        <span className="ri-meta">
                          <span className="ri-label">{label}</span>
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
              {expanded && (
                <div className="rail-card">
                  <p className="rail-card-t">{t("noteTitle")}</p>
                  <p className="rail-card-b">{t("noteBody")}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Preferences + log out — pinned to the card's bottom edge so
            they stay reachable even when the nav groups scroll. */}
        {user && (
          <div className="rail-foot">
            <div className="rail-prefs">
              <div role="group" aria-label={t("langLabel")} className="seg rail-lang">
                {routing.locales.map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    aria-pressed={loc === locale}
                    title={loc.toUpperCase()}
                    onClick={() => switchLocale(loc)}
                  >
                    {loc}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="rail-theme"
                aria-label={tm("navThemeToggle")}
                title={tm("navThemeToggle")}
                onClick={toggleTheme}
              >
                <Sun aria-hidden className="ico-sun" size={16} />
                <Moon aria-hidden className="ico-moon" size={16} />
              </button>
            </div>
            <button type="button" className="rail-logout" onClick={logout} disabled={busy}>
              <LogOut size={16} aria-hidden />
              {expanded && <span className="label">{ta("logout")}</span>}
            </button>
          </div>
        )}
      </nav>

      {/* Mobile floating open button */}
      {mobile && !expanded && (
        <button
          type="button"
          className="rail-fab"
          onClick={() => setMobOpen(true)}
          aria-label={tm("navMenu")}
        >
          <Menu size={19} aria-hidden />
        </button>
      )}

      {/* ── The page content — keeps its own .wrap centering ── */}
      <div className="app-main">{children}</div>
    </div>
  );
}
