"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Menu, User, X } from "lucide-react";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { sections } from "@/lib/shell";
import { ThemeToggle } from "./ThemeToggle";

/**
 * PreLife site navigation — the ORIGINAL Ultrahuman shrink bar, wearing
 * the rewrite's palette. At the top of the page it is a full-bleed solid
 * strip (4rem, edge-to-edge, square corners, painted in --bg so it
 * disappears into the page); once the page scrolls past 24px the
 * wrapper's padding animates to (max(0.75rem,5vw) / pt-3) while the bar
 * morphs into a smaller floating frosted-glass pill. The material itself
 * is painted on a ::before layer (see globals.css).
 *
 * Layout follows the Ultrahuman bar: burger + section links LEFT (Gym,
 * Diet, Psychology, Books), wordmark CENTER (absolute, pill-centered),
 * and the right cluster carries the language switcher (sm+), the
 * dark/light toggle, the account icon and the "Get started" pill (lg+).
 * All bar controls sit on the 4px grid: links h-9, controls h-10.
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

export function Nav() {
  const t = useTranslations("moduleCommon");
  const th = useTranslations("welcomePage");
  const ts = useTranslations("sections");
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

  return (
    <header className="nav" data-scrolled={scrolled}>
      {/* The Ultrahuman shrink: the wrapper's padding (0 at the top of
          the page → max(0.75rem,5vw) + pt-3 when scrolled) is what pulls
          the full-bleed bar inward; the bar itself only trades its square
          corners and solid fill for the glass pill material. */}
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
            <ul className="nav-links">
              {sections.map((s) => (
                <li key={s.id}>
                  <Link href={s.href} aria-current={on(s.href) ? "page" : undefined}>
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
            <Link href="/home" aria-label={th("header.account")} className="icon-btn nav-account hide-md">
              <User size={18} strokeWidth={1.5} aria-hidden />
            </Link>
            {/* TEST-ONLY (per user): Get started opens Home directly — the
                real onboarding/account flow replaces this in a later phase. */}
            <Link href="/home" className="nav-start hide-md">
              {th("header.getStarted")}
            </Link>
          </div>
        </div>
      </div>

      {open && (
        <div className="nav-panel">
          <p className="eyebrow">{th("header.drawerSectionsLabel")}</p>
          <ul className="panel-links">
            {sections.map((s) => (
              <li key={s.id}>
                <Link href={s.href} aria-current={on(s.href) ? "page" : undefined}>
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
            <Link href="/home" onClick={() => setOpen(false)} className="nav-start">
              {th("header.getStarted")}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
