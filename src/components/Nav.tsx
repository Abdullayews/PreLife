"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Menu, User, X } from "lucide-react";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { sections } from "@/lib/shell";
import { hasConsent, persistLocale } from "@/lib/consent";
import { saveUserPref } from "@/lib/user-prefs";
import { ThemeToggle } from "./ThemeToggle";

/** The account summary the bar needs from the session. */
export type MenuUser = { name: string | null; email: string };

/**
 * The top bar — matched to the two halves of the site.
 *
 * v2.3: signed-in users keep this bar on the WELCOME surface only; on
 * the app surface it hides itself (the İdman glass rail in AppShell is
 * their navigation + management surface there). Guests see it
 * everywhere. The decision lives here, not in the layout, because only
 * this component knows the pathname:
 *
 * • WELCOME surface (/welcome, /login, /signup, /terms, /rules) — the
 *   Ultrahuman anchor: burger + section links LEFT, wordmark absolutely
 *   CENTERED, right cluster carries the language segment (sm+), the
 *   theme toggle, and either the account icon → /home (signed in) or
 *   Sign in + Get started (signed out).
 *
 * • APP surface (a signed-out /home or /help visit): wordmark LEFT next
 *   to the burger, main tabs on the RIGHT TOP (Gym, Diet, Psychology,
 *   Books, Subscription) + the same guest cluster.
 *
 * Both share the same shrink behaviour: full-bleed solid strip at the top
 * of the page, floating frosted-glass pill past 24px of scroll.
 */

/** Routes that belong to the logged-in app (the "main pages" experience). */
const APP_HREFS = ["/home", "/gym", "/diet", "/meditation", "/library", "/subscription", "/settings", "/profile", "/help", "/admin"];

function LocaleSwitch({ className = "", signedIn = false }: { className?: string; signedIn?: boolean }) {
  const t = useTranslations("welcomePage.header");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  return (
    // v5.2 (loop iter 3): native fieldset (was div role="group") —
    // globals.css :where(fieldset) resets the chrome.
    <fieldset aria-label={t("language")} className={`seg${className ? ` ${className}` : ""}`}>
      {routing.locales.map((loc) => (
        <button
          key={loc}
          type="button"
          aria-pressed={loc === locale}
          onClick={() => {
            // Keep the shareable query (?tab=, psychologist fit-filters) —
            // a bare pathname replace silently drops it.
            const query = typeof window === "undefined" ? "" : window.location.search;
            router.replace(query ? `${pathname}${query}` : pathname, { locale: loc });
            // Guest tiers: nothing is stored before consent; after consent
            // the choice is remembered as a persistent 1-year cookie.
            if (hasConsent()) persistLocale(loc);
            // Account tier (v3.2): signed-in users also save the choice to
            // their profiles row, so it follows them across devices.
            if (signedIn) saveUserPref({ locale: loc });
          }}
        >
          {loc}
        </button>
      ))}
    </fieldset>
  );
}

export function Nav({ user }: { user: MenuUser | null }) {
  const t = useTranslations("moduleCommon");
  const th = useTranslations("welcomePage");
  const ts = useTranslations("sections");
  const ta = useTranslations("accountMenu");
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => setOpen(false), [pathname]);

  const on = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const isApp = APP_HREFS.some(on);

  // v2.3: on the app surface a signed-in visitor navigates via the İdman
  // rail (AppShell) — the top bar belongs to the welcome surface (and
  // to guests everywhere). Below every hook, so the rules of hooks hold.
  if (user && isApp) return null;

  // Every main tab in display order — gym first, matching the welcome page.
  const tabs = [
    ...sections.map((s) => ({ href: s.href as string, label: ts(`${s.id}.name`) })),
    { href: "/subscription", label: th("header.drawerSubscription") },
  ];

  return (
    <header className="nav" data-scrolled={scrolled} data-surface={isApp ? "app" : "welcome"}>
      <div className="nav-shrink">
        <div className="nav-pill">
          {isApp ? (
            <>
              {/* ── App bar (guest visit): brand LEFT, main tabs RIGHT TOP ── */}
              <div className="nav-side">
                <button
                  type="button"
                  className="icon-btn nav-burger"
                  aria-expanded={open}
                  aria-label={open ? t("navClose") : t("navMenu")}
                  onClick={() => setOpen((v) => !v)}
                >
                  {open ? <X size={20} aria-hidden /> : <Menu size={20} aria-hidden />}
                </button>
                <Link href="/welcome" aria-label={t("navHome")} className="brand">
                  Pre<em>Life</em>
                </Link>
              </div>

              <div className="nav-tools">
                <ul className="nav-tabs">
                  {tabs.map((tab) => (
                    <li key={tab.href}>
                      <Link href={tab.href} aria-current={on(tab.href) ? "page" : undefined}>
                        {tab.label}
                      </Link>
                    </li>
                  ))}
                </ul>
                <LocaleSwitch className="nav-lang" />
                <ThemeToggle />
                <Link href="/login" className="nav-signin">
                  {ta("signIn")}
                </Link>
                <Link href="/signup" className="nav-start hide-md">
                  {th("header.getStarted")}
                </Link>
              </div>
            </>
          ) : (
            <>
              {/* ── Welcome bar: links LEFT, wordmark CENTER. The section
                  links open the PUBLIC marketing pages under
                  /welcome/<slug> — no account needed. ── */}
              <div className="nav-side">
                <button
                  type="button"
                  className="icon-btn nav-burger"
                  aria-expanded={open}
                  aria-label={open ? t("navClose") : t("navMenu")}
                  onClick={() => setOpen((v) => !v)}
                >
                  {open ? <X size={20} aria-hidden /> : <Menu size={20} aria-hidden />}
                </button>
                <ul className="nav-links">
                  {sections.map((s) => (
                    <li key={s.id}>
                      <Link href={s.welcomeHref} aria-current={on(s.welcomeHref) ? "page" : undefined}>
                        {ts(`${s.id}.name`)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              <Link href="/welcome" aria-label={t("navHome")} className="brand">
                Pre<em>Life</em>
              </Link>

              <div className="nav-tools">
                <LocaleSwitch className="hide-sm" signedIn={!!user} />
                {/* v6.1: the light/dark toggle lives ONLY in Settings for
                 * signed-in users — guests (no Settings access) keep it
                 * here on the public surface. */}
                {!user && <ThemeToggle />}
                {user ? (
                  <Link href="/home" aria-label={th("header.account")} className="icon-btn nav-account hide-md">
                    <User size={18} strokeWidth={1.5} aria-hidden />
                  </Link>
                ) : (
                  <>
                    <Link href="/login" className="nav-signin">
                      {ta("signIn")}
                    </Link>
                    <Link href="/signup" className="nav-start hide-md">
                      {th("header.getStarted")}
                    </Link>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {open && (
        <div className="nav-panel">
          {isApp ? (
            <>
              <p className="eyebrow">{th("header.drawerSectionsLabel")}</p>
              <ul className="panel-links">
                <li>
                  <Link href="/home" aria-current={on("/home") ? "page" : undefined}>
                    {th("tabs.home")}
                  </Link>
                </li>
                {tabs.map((tab) => (
                  <li key={tab.href}>
                    <Link href={tab.href} aria-current={on(tab.href) ? "page" : undefined}>
                      {tab.label}
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="eyebrow panel-sep">{th("header.drawerPlatformLabel")}</p>
              <ul className="panel-links">
                <li>
                  <Link href="/terms">{ta("terms")}</Link>
                </li>
                <li>
                  <Link href="/cookies">{ta("cookies")}</Link>
                </li>
                <li>
                  <Link href="/rules">{ta("rules")}</Link>
                </li>
              </ul>
              <div className="panel-row">
                <LocaleSwitch />
                <Link href="/signup" onClick={() => setOpen(false)} className="nav-start">
                  {th("header.getStarted")}
                </Link>
              </div>
            </>
          ) : (
            <>
              <p className="eyebrow">{th("header.drawerSectionsLabel")}</p>
              <ul className="panel-links">
                {sections.map((s) => (
                  <li key={s.id}>
                    <Link href={s.welcomeHref} aria-current={on(s.welcomeHref) ? "page" : undefined}>
                      {ts(`${s.id}.name`)}
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="eyebrow panel-sep">{th("header.drawerPlatformLabel")}</p>
              <ul className="panel-links">
                <li>
                  <Link href="/home" aria-current={on("/home") ? "page" : undefined}>
                    {th("tabs.home")}
                  </Link>
                </li>
                <li>
                  <Link href="/subscription" aria-current={on("/subscription") ? "page" : undefined}>
                    {th("header.drawerSubscription")}
                  </Link>
                </li>
              </ul>
              <div className="panel-row">
                <LocaleSwitch signedIn={!!user} />
                {user ? (
                  <Link href="/home" onClick={() => setOpen(false)} className="nav-start">
                    {th("tabs.home")}
                  </Link>
                ) : (
                  <Link href="/signup" onClick={() => setOpen(false)} className="nav-start">
                    {th("header.getStarted")}
                  </Link>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </header>
  );
}
