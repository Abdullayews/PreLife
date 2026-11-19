"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  AudioLines, Backpack, BookOpen, Brain, CalendarDays, ChefHat, ChevronLeft,
  ChevronRight, Circle, CircleHelp, Crown, Dumbbell, FileText, Flower2, House,
  Landmark, Layers, LibraryBig, LogOut, MapPin, MonitorPlay, Moon, NotebookPen,
  Pill, Salad, ScrollText, Settings, Shirt, Sun, UserRound, Users, Wind,
  type LucideIcon,
} from "lucide-react";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { sections } from "@/lib/shell";
import { apiUrl } from "@/lib/api-url";
import { hasConsent, setThemeChoice } from "@/lib/consent";
import { saveUserPref } from "@/lib/user-prefs";

/**
 * AppShell v4 — THE left management panel (v2.2).
 *
 * One rail, three jobs, present on every registered-user page:
 *
 * • IDENTITY — the signed-in account (avatar, name, email) with the
 *   fold button right beside it.
 * • NAVIGATION — the main pages (Home · Gym · Diet · Psychology ·
 *   Books · Subscription), each with a one-line description; when the
 *   page belongs to a section, its subtabs nest underneath as their own
 *   group (link mode = real routes, tab mode = in-page tablist).
 * • MANAGEMENT — everything account-related used to live in scattered
 *   places (the top-right user dropdown, the nav's language/theme
 *   toggles); it now lives here: Profile, Settings, Help, Terms, Rules,
 *   the language segment, the theme toggle and Log out.
 *
 * Two widths, one button: fully open (labels + descriptions) or
 * icon-only. The choice is remembered post-consent (localStorage).
 *
 * The rail is STICKY on lg+: scrolling the page keeps the panel in
 * view (it follows the reader down), with its own internal scroll when
 * the stack outgrows the viewport. On mobile it degrades to the
 * horizontal subtab capsule strip — management stays in the burger
 * drawer there.
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
  /** The section's display name — the caption above its subtab group. */
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
  /** Kept for API compatibility — v2.2 has its own fold state. */
  storageKey?: string;
  children: ReactNode;
};

/** Where the fold choice is remembered (only after cookie consent). */
const FOLD_KEY = "pl_rail_fold";

export function AppShell({
  mode, tabs, activeId, hrefs, onSelect, ui, user, children,
}: Props) {
  const listRef = useRef<HTMLUListElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [folded, setFolded] = useState(false);
  const [busy, setBusy] = useState(false);

  const t = useTranslations("sidePanel");
  const th = useTranslations("welcomePage");
  const ts = useTranslations("sections");
  const ta = useTranslations("accountMenu");
  const tm = useTranslations("moduleCommon");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  /* Fold state: the stored choice returns post-consent, otherwise the
   * panel starts fully open (and stays in memory only). */
  useEffect(() => {
    if (!hasConsent()) return;
    try {
      if (localStorage.getItem(FOLD_KEY) === "1") setFolded(true);
    } catch { /* storage unavailable */ }
  }, []);

  const fold = () => {
    setFolded((v) => {
      const next = !v;
      if (hasConsent()) {
        try { localStorage.setItem(FOLD_KEY, next ? "1" : "0"); } catch { /* ignore */ }
      }
      return next;
    });
  };

  /* The same scroll signal the top nav uses (24px threshold): on mobile
   * the horizontal strip morphs into the floating frosted capsule. */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* Density: few subtabs → roomy pills, many → compact ones, so every
   * section's stack fits its column. (≤4 cozy · 5-6 regular · ≥7 compact) */
  const density = tabs.length >= 7 ? "compact" : tabs.length >= 5 ? "regular" : "cozy";

  /* Roving focus across the subtab list (tab mode). */
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

  return (
    <div
      className="app-shell"
      data-scrolled={scrolled}
      data-density={density}
      data-folded={folded}
      data-hassub={tabs.length > 0 ? "true" : "false"}
    >
      {/* ── The rail: on lg+ the sticky management panel; on mobile the
          horizontal subtab capsule strip. ── */}
      <nav className="app-rail" aria-label={user ? t("navLabel") : ui.label}>
        <div className="app-rail-clip">
          {/* Identity + the fold button (lg+, signed in) */}
          {user && (
            <div className="rail-id">
              <span className="rail-avatar" aria-hidden>{initials}</span>
              <span className="rail-id-meta">
                <b>{user.name ?? user.email}</b>
                <span>{user.email}</span>
              </span>
              <button
                type="button"
                className="icon-btn rail-fold"
                aria-label={folded ? t("expand") : t("collapse")}
                title={folded ? t("expand") : t("collapse")}
                onClick={fold}
              >
                {folded ? <ChevronRight size={16} aria-hidden /> : <ChevronLeft size={16} aria-hidden />}
              </button>
            </div>
          )}

          {/* Main pages */}
          <p className="rail-cap" aria-hidden>{t("mainCaption")}</p>
          <ul className="rail-nav">
            {mainNav.map(({ href, label, icon: Icon, desc }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="rail-item"
                  aria-current={ariaCurrent(href)}
                  title={label}
                >
                  <Icon size={18} aria-hidden />
                  <span className="ri-meta">
                    <span className="ri-label">{label}</span>
                    <span className="ri-desc">{desc}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          {/* The section's subtabs (when the page has any) */}
          {tabs.length > 0 && ui.title && (
            <p className="rail-cap" aria-hidden>{ui.title}</p>
          )}
          <ul
            className="app-tabs"
            ref={listRef}
            aria-label={ui.label}
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
                      className="app-tab"
                      aria-current={isActive ? "page" : undefined}
                      title={tab.label}
                      onClick={() => onSelect?.(tab.id)}
                    >
                      <Icon size={18} aria-hidden />
                      <span className="label">{srCurrent}{tab.label}</span>
                    </Link>
                  ) : (
                    <button
                      type="button"
                      role="tab"
                      className="app-tab"
                      aria-selected={isActive}
                      aria-controls="app-panel"
                      title={tab.label}
                      onClick={() => onSelect?.(tab.id)}
                    >
                      <Icon size={18} aria-hidden />
                      <span className="label">{srCurrent}{tab.label}</span>
                    </button>
                  )}
                </li>
              );
            })}
          </ul>

          {/* Management (lg+, signed in) */}
          {user && (
            <ul className="rail-nav rail-manage">
              {manageNav.map(({ href, label, icon: Icon }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="rail-item"
                    aria-current={ariaCurrent(href)}
                    title={label}
                  >
                    <Icon size={18} aria-hidden />
                    <span className="ri-meta">
                      <span className="ri-label">{label}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
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
                className="icon-btn rail-theme"
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
              <span className="label">{ta("logout")}</span>
            </button>
          </div>
        )}
      </nav>

      {/* ── The section's content — keeps its own .wrap centering ── */}
      <div className="app-main">{children}</div>
    </div>
  );
}
