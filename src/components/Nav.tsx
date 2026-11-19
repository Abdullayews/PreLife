"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Menu, X } from "lucide-react";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { sections } from "@/lib/shell";
import { hasConsent, persistLocale } from "@/lib/consent";
import { ThemeToggle } from "./ThemeToggle";

/**
 * The GUEST bar — matched to the two halves of the site.
 *
 * v2.2: registered users never see this component (the İdman glass rail
 * in AppShell is their one navigation + management surface); everything
 * below renders for signed-out visitors only, so every branch is the
 * guest variant:
 *
 * • WELCOME surface (/welcome, /login, /signup, /terms, /rules) — the
 *   Ultrahuman anchor: burger + section links LEFT, wordmark absolutely
 *   CENTERED, right cluster carries the language segment (sm+), the
 *   theme toggle, Sign in + Get started.
 *
 * • APP surface (a signed-out /home or /help visit): wordmark LEFT next
 *   to the burger, main tabs on the RIGHT TOP (Gym, Diet, Psychology,
 *   Books, Subscription) + the same guest cluster.
 *
 * Both share the same shrink behaviour: full-bleed solid strip at the top
 * of the page, floating frosted-glass pill past 24px of scroll.
 */

/** Routes that belong to the logged-in app (the "main pages" experience). */
const APP_HREFS = ["/home", "/gym", "/diet", "/meditation", "/library", "/subscription", "/settings", "/profile", "/help"];

function LocaleSwitch({ className = "" }: { className?: string }) {
  const t = useTranslations("welcomePage.header");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  return (
    <div role="group" aria-label={t("language")} className={`seg${className ? ` ${className}` : ""}`}>
      {routing.locales.map((loc) => (
        <button
          key={loc}
          type="button"
          aria-pressed={loc === locale}
          onClick={() => {
            router.replace(pathname, { locale: loc });
            // Nothing is stored before consent; after consent the choice
            // is remembered as a persistent 1-year cookie.
            if (hasConsent()) persistLocale(loc);
          }}
        >
          {loc}
        </button>
      ))}
    </div>
  );
}

export function Nav() {
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
                <LocaleSwitch className="hide-sm" />
                <ThemeToggle />
                <Link href="/login" className="nav-signin">
                  {ta("signIn")}
                </Link>
                <Link href="/signup" className="nav-start hide-md">
                  {th("header.getStarted")}
                </Link>
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
                <LocaleSwitch />
                <Link href="/signup" onClick={() => setOpen(false)} className="nav-start">
                  {th("header.getStarted")}
                </Link>
              </div>
            </>
          )}
        </div>
      )}
    </header>
  );
}
