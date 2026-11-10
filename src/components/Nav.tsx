"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Menu, X } from "lucide-react";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { sections } from "@/lib/shell";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu, type MenuUser } from "./UserMenu";

/**
 * PreLife site navigation — the Ultrahuman shrink bar.
 * Layout: burger LEFT (below xl), wordmark CENTER, and on the RIGHT TOP
 * every main tab gets its own button (Gym, Diet, Psychology, Books,
 * Subscription) — clicking one switches the UI to that main page.
 * The right cluster also carries the language segment (xl+), the theme
 * toggle, and either the account menu (signed in) or Sign in / Get
 * started (signed out).
 */

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
          onClick={() => router.replace(pathname, { locale: loc })}
        >
          {loc}
        </button>
      ))}
    </div>
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

  // Every main tab in display order — gym first, matching the welcome page.
  const tabs = [
    ...sections.map((s) => ({ href: s.href as string, label: ts(`${s.id}.name`) })),
    { href: "/subscription", label: th("header.drawerSubscription") },
  ];

  return (
    <header className="nav" data-scrolled={scrolled}>
      <div className="nav-shrink">
        <div className="nav-pill">
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
            <Link href={user ? "/home" : "/welcome"} aria-label={t("navHome")} className="brand">
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

            {user ? (
              <UserMenu user={user} />
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
        </div>
      </div>

      {open && (
        <div className="nav-panel">
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
        </div>
      )}
    </header>
  );
}
