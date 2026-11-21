"use client";

import {
  useEffect, useRef, useState, useSyncExternalStore, type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import {
  AudioLines, Backpack, BookOpen, Brain, CalendarDays, ChefHat, ChevronsUpDown,
  Circle, CircleHelp, ClipboardCheck, Crown, Dumbbell, FileText, Flower2, House, Landmark, Layers,
  LibraryBig, MapPin, Menu, MonitorPlay, NotebookPen, PanelLeftClose,
  PanelLeftOpen, Pill, Salad, ScrollText, Settings, Shirt, UserRound, Users,
  Wind, type LucideIcon,
} from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { sections } from "@/lib/shell";
import { hasConsent } from "@/lib/consent";
import { saveUserPref } from "@/lib/user-prefs";

/**
 * AppShell v6 — the İdman glass rail, global for every logged-in page.
 *
 * The v2.2 flat management panel is restyled (and re-architected on mobile)
 * after the İdman v3 design the team shipped for the gym surface — now the
 * ONE design language for the registered-user app:
 *
 * • GLASS — backdrop blur(22px) saturate(1.6), 28px radius, 82% surface,
 *   inset highlight — a floating card, not a strip. On lg+ the card floats
 *   VERTICALLY CENTERED beside the content (equal air above and below).
 * • TWO WIDTHS — fully open (labels + one-line descriptions) or icon-only
 *   (4.75rem), switched by the fold button beside the brand, remembered
 *   post-consent. The grid column animates .45s. Collapsed, the brand and
 *   the fold button STACK (no cramping) and every row centers its icon.
 * • NESTED SUBTABS — the current section's row becomes the group head
 *   (caret, collapsible); its subtabs nest underneath (link mode = real
 *   routes, tab mode = in-page tablist), exactly like the İdman group.
 *   The row keeps ITS position in the list — the order never shuffles
 *   (v5.1: Home is always first).
 * • ACCOUNT DROPDOWN (v6) — the identity row at the top is a button;
 *   pressing it opens the account menu DOWNWARD (Profile, Settings, Help,
 *   Terms, Rules). No e-mail in the rail; language, theme and log out
 *   live in Settings; the "What's new" card is gone. The foot is empty —
 *   the light/dark toggle exists ONLY in Settings → Appearance (v6.1).
 * • FOLD STATE (v6.1) — signed-in users get the fold choice from the
 *   SERVER (profiles.rail_folded rides on the session row), so every
 *   page renders the rail in the right width on first paint and the
 *   choice follows the account across devices. Guests keep the
 *   consent-gated localStorage tier.
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

export type ShellUser = {
  name: string | null;
  email: string;
  /** Profile photo (data URL) — rides on the session row (v3.3). */
  avatar?: string | null;
  /** The rail fold choice from the server (v6.1) — first-paint correct. */
  railFolded?: boolean;
  /** v3.4: 'psychologist' shows the console link in the rail. */
  role?: "user" | "psychologist";
  /** v3.4: the linked psychologists_v2 slug (console guard). */
  psychSlug?: string | null;
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
  /** The signed-in account — when present the identity + foot render. */
  user?: ShellUser | null;
  /** Whether the TOP nav renders for this visit. Derived from `user`
   *  (no session → the Nav shows) unless the page knows better (the gym
   *  demo fallback renders the rail with a demo account while the guest
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
  /* Signed-in: the server-rendered fold choice (session row) — no flash,
   * no hydration dance. Guests: start open, localStorage may fold after. */
  const [folded, setFolded] = useState<boolean>(() => user?.railFolded === true);
  const [mobOpen, setMobOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(true);
  const [acctOpen, setAcctOpen] = useState(false);

  const t = useTranslations("sidePanel");
  const th = useTranslations("welcomePage");
  const ts = useTranslations("sections");
  const ta = useTranslations("accountMenu");
  const tm = useTranslations("moduleCommon");
  const pathname = usePathname();

  const mobile = useSyncExternalStore(subscribeMobile, getMobileSnapshot, getMobileServer);
  const expanded = mobile ? mobOpen : !folded;

  /* Guests only: the stored fold choice returns post-consent; otherwise
   * the rail starts fully open (and stays in memory only). Signed-in
   * users carry the choice on their account (see toggleRail). */
  useEffect(() => {
    if (user || !hasConsent()) return;
    try {
      if (localStorage.getItem(FOLD_KEY) === "1") setFolded(true);
    } catch { /* storage unavailable */ }
  }, [user]);

  /* Overlay hygiene: a route change closes the mobile drawer and the
   * account dropdown. */
  useEffect(() => {
    setMobOpen(false);
    setAcctOpen(false);
  }, [pathname]);

  /* Escape closes the mobile overlay and the account dropdown; a pointer
   * press outside the rail account block closes the dropdown too. */
  useEffect(() => {
    if (!mobile) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobOpen(false);
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [mobile]);

  useEffect(() => {
    if (!acctOpen) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAcctOpen(false);
    };
    const press = (e: PointerEvent) => {
      const el = e.target instanceof Element ? e.target.closest(".rail-account") : null;
      if (!el) setAcctOpen(false);
    };
    document.addEventListener("keydown", key);
    document.addEventListener("pointerdown", press);
    return () => {
      document.removeEventListener("keydown", key);
      document.removeEventListener("pointerdown", press);
    };
  }, [acctOpen]);

  const toggleRail = () => {
    if (mobile) { setMobOpen((v) => !v); return; }
    setFolded((v) => {
      const next = !v;
      if (next) setAcctOpen(false);
      if (user) {
        // v6.1: the choice lives on the account — every device, every
        // page render. (Mirrored onto the session row server-side.)
        saveUserPref({ railFolded: next });
      } else if (hasConsent()) {
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

  /* Main pages — Home first, the four sections, Subscription last.
   * v3.4: linked psychologist accounts also get the console link right
   * after the sections (their account surface for confirming requests). */
  const mainNav: { href: string; label: string; icon: LucideIcon; desc: string }[] = [
    { href: "/home", label: th("tabs.home"), icon: House, desc: t("desc.home") },
    ...sections.map((s) => ({
      href: s.href as string, label: ts(`${s.id}.name`), icon: s.icon, desc: t(`desc.${s.id}`),
    })),
    ...(user?.role === "psychologist"
      ? [{ href: "/meditation/console", label: t("console"), icon: ClipboardCheck, desc: t("consoleDesc") }]
      : []),
    { href: "/subscription", label: th("header.drawerSubscription"), icon: Crown, desc: t("desc.subscription") },
  ];

  /* Account menu — the old management group, now the dropdown that opens
   * downward from the identity row at the top of the rail. */
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

  /* The rail never shows the e-mail — the name, or the handle before the
   * @ when the profile has no name yet. */
  const displayName = user
    ? (user.name?.trim() || user.email.split("@")[0]!)
    : "";

  /* The section whose row becomes the nested group head (when the page
   * carries subtabs): the current section, matched by route prefix. The
   * row keeps ITS position in the list — only its markup changes (v5.1:
   * the order never shuffles; Home stays first). */
  const groupHref = tabs.length > 0
    ? mainNav.find(({ href }) => on(href))?.href
    : undefined;

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

  /* The identity button: collapsed, it expands the rail; open, it toggles
   * the account menu that drops down beneath it. */
  const onAccountClick = () => {
    if (!expanded) {
      if (mobile) setMobOpen(true);
      else setFolded(false);
      setAcctOpen(true);
      return;
    }
    setAcctOpen((v) => !v);
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

      {/* ── The glass rail ── the .rail-dock wrapper is display:contents
         * on mobile (the nav is fixed) and becomes the sticky, exactly
         * viewport-tall flex box that keeps the card VERTICALLY CENTERED
         * on lg+ — re-centering live as the card grows/shrinks. ── */}
      <div className="rail-dock">
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
            title={expanded ? t("collapse") : t("expand")}
          >
            {expanded
              ? <PanelLeftClose size={17} aria-hidden />
              : <PanelLeftOpen size={17} aria-hidden />}
          </button>
        </div>

        <div className="app-rail-clip">
          {/* Identity → the account dropdown */}
          {user && (
            <div className="rail-account">
              <button
                type="button"
                className="rail-id"
                onClick={onAccountClick}
                aria-expanded={expanded && acctOpen}
                aria-controls="rail-account-menu"
                title={!expanded ? t("accountMenuLabel") : undefined}
              >
                <span className="rail-avatar" aria-hidden>
                  {user.avatar ? <img src={user.avatar} alt="" /> : initials}
                </span>
                {expanded && (
                  <>
                    <span className="rail-id-meta">
                      <b>{displayName}</b>
                    </span>
                    <ChevronsUpDown
                      size={14} aria-hidden
                      className="rail-id-caret"
                      style={{ transform: acctOpen ? "rotate(180deg)" : "none" }}
                    />
                  </>
                )}
              </button>
              <div
                id="rail-account-menu"
                className={`rail-acct${acctOpen && expanded ? " open" : ""}`}
              >
                <ul aria-label={t("accountMenuLabel")}>
                  {manageNav.map(({ href, label, icon: Icon }) => (
                    <li key={href}>
                      <Link
                        href={href}
                        className={`rail-item${on(href) ? " active" : ""}`}
                        aria-current={ariaCurrent(href)}
                        title={!expanded ? label : undefined}
                      >
                        <span className="rail-ic" aria-hidden><Icon size={18} strokeWidth={2} /></span>
                        {expanded && (
                          <span className="ri-meta">
                            <span className="ri-label">{label}</span>
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
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
                    aria-expanded={expanded && groupOpen}
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
        </div>
      </nav>
      </div>

      {/* v6.1: the foot is gone — the light/dark toggle lives ONLY in
       * Settings → Appearance; language and log out also stay in
       * Settings. Nothing else pins to the rail's bottom edge. */}

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

      {/* ── The page content — keeps its own .wrap centering ──
       * v5.2 (loop iter 3): while the mobile rail drawer is open, the page
       * behind the scrim goes inert (same pattern as AiChatFab) so focus
       * can't escape into covered content. */}
      <div className="app-main" inert={mobile && expanded}>{children}</div>
    </div>
  );
}
