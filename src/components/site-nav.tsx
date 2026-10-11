"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { Menu, User, X } from "lucide-react";
import { capstoneSections } from "@/lib/capstone";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * PreLife site navigation — ONE floating glass pill for the whole site
 * (frontend v4 system). The bar starts full-width at the top of the page
 * and morphs into a floating frosted-glass pill once the page scrolls;
 * the same links travel with you across every page. The wordmark's
 * "Life" — and the little dot beside it — pick up the current module
 * accent through --site-accent, which globals.css maps per page via
 * body:has([data-module=...]).
 *
 * Placement follows the current PreLife bar: hamburger + section links
 * LEFT (capstone order: Psikoloji, Kitab, Sport, Diet), wordmark CENTER,
 * and the right cluster carries the language switcher, the dark/light
 * toggle, the account icon and the "Get started" pill (→ /home while the
 * real onboarding lands).
 */

function LocaleSwitch({ className }: { className?: string }) {
  const t = useTranslations("moduleCommon");
  const tw = useTranslations("welcomePage");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div
      role="group"
      aria-label={tw("header.language")}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border p-1",
        className,
      )}
      style={{ borderColor: "var(--nav-glass-line)" }}
    >
      {routing.locales.map((loc) => {
        const active = loc === locale;
        return (
          <button
            key={loc}
            type="button"
            onClick={() => router.replace(pathname, { locale: loc })}
            aria-pressed={active}
            className={cn(
              "h-7 rounded-full px-2.5 text-[11px] font-bold uppercase tracking-wider transition-colors",
              active && "shadow-sm",
            )}
            style={
              active
                ? {
                    backgroundColor: "var(--site-accent-soft)",
                    color: "var(--site-accent)",
                  }
                : { color: "var(--nav-glass-muted)" }
            }
          >
            {loc}
          </button>
        );
      })}
    </div>
  );
}

export function SiteNav() {
  const t = useTranslations("moduleCommon");
  const tw = useTranslations("welcomePage");
  const ts = useTranslations("sections");
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <nav aria-label={t("navAriaLabel")} className="sticky top-0 z-50">
      <div>
        <div
          className={cn(
            "relative mx-auto flex items-center justify-between gap-3 px-4 transition-all duration-300 md:px-6",
            scrolled
              ? "mt-3 h-16 max-w-5xl rounded-full border shadow-[var(--nav-glass-shadow)] backdrop-blur-xl md:px-5"
              : "h-20 max-w-6xl border-transparent",
          )}
          style={
            scrolled
              ? {
                  borderColor: "var(--nav-glass-line)",
                  backgroundColor: "var(--nav-glass-bg)",
                }
              : undefined
          }
        >
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-label={menuOpen ? t("navClose") : t("navMenu")}
              className="inline-flex size-10 items-center justify-center rounded-full transition-colors hover:bg-[var(--nav-glass-hover)] md:hidden"
              style={{ color: "var(--nav-glass-ink)" }}
            >
              {menuOpen ? (
                <X aria-hidden className="size-5" />
              ) : (
                <Menu aria-hidden className="size-5" />
              )}
            </button>
            <ul className="hidden items-center gap-1 md:flex">
              {capstoneSections.map((section) => {
                const active = isActive(section.href);
                return (
                  <li key={section.id}>
                    <Link
                      href={section.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "rounded-full px-3.5 py-2 text-[15px] transition-colors",
                        active && "font-semibold",
                      )}
                      style={
                        active
                          ? {
                              backgroundColor: "var(--site-accent-soft)",
                              color: "var(--site-accent)",
                            }
                          : { color: "var(--nav-glass-muted)" }
                      }
                    >
                      <span
                        aria-hidden
                        className="mr-1.5 inline-block size-1.5 rounded-full align-middle"
                        style={{
                          backgroundColor: active
                            ? "var(--site-accent)"
                            : "var(--nav-glass-line)",
                        }}
                      />
                      {ts(`${section.id}.name`)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          <Link
            href="/welcome"
            aria-label={t("navHome")}
            className="pl-display absolute left-1/2 -translate-x-1/2 text-xl font-extrabold tracking-tight md:text-[22px]"
            style={{ color: "var(--nav-glass-ink)" }}
          >
            Pre<span style={{ color: "var(--site-accent)" }}>Life</span>
            <span
              aria-hidden
              className="ml-1.5 inline-block size-1.5 rounded-full align-middle"
              style={{ backgroundColor: "var(--site-accent)" }}
            />
          </Link>

          <div className="flex items-center gap-2">
            <LocaleSwitch className="hidden sm:inline-flex" />
            <ThemeToggle />
            <Link
              href="/home"
              aria-label={tw("header.account")}
              className="hidden size-10 items-center justify-center rounded-full border transition-colors hover:bg-[var(--nav-glass-hover)] sm:inline-flex"
              style={{
                borderColor: "var(--nav-glass-line)",
                color: "var(--nav-glass-ink)",
              }}
            >
              <User aria-hidden className="size-[18px]" strokeWidth={1.5} />
            </Link>
            {/* TEST-ONLY (per user): Get started opens Home directly — the
                real onboarding/account flow replaces this in a later phase. */}
            <Link
              href="/home"
              className="pl-nav-start hidden h-10 items-center rounded-full px-5 text-sm font-semibold transition-opacity hover:opacity-90 md:inline-flex"
              style={{ backgroundColor: "var(--site-accent)" }}
            >
              {tw("header.getStarted")}
            </Link>
          </div>
        </div>
      </div>

      {menuOpen ? (
        <div
          className="mx-4 mt-2 rounded-2xl border p-3 shadow-[var(--nav-glass-shadow)] backdrop-blur-xl md:hidden"
          style={{
            borderColor: "var(--nav-glass-line)",
            backgroundColor: "var(--nav-glass-panel)",
          }}
        >
          <p
            className="px-3 pb-2 pt-1 text-[11px] font-medium uppercase tracking-[0.14em]"
            style={{ color: "var(--nav-glass-muted)" }}
          >
            {tw("header.drawerSectionsLabel")}
          </p>
          <ul className="flex flex-col">
            {capstoneSections.map((section) => {
              const active = isActive(section.href);
              return (
                <li key={section.id}>
                  <Link
                    href={section.href}
                    aria-current={active ? "page" : undefined}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-[var(--nav-glass-hover)]"
                    style={{
                      color: active
                        ? "var(--site-accent)"
                        : "var(--nav-glass-ink)",
                      fontWeight: active ? 600 : 400,
                    }}
                  >
                    <span
                      aria-hidden
                      className="inline-block size-1.5 rounded-full"
                      style={{
                        backgroundColor: active
                          ? "var(--site-accent)"
                          : "var(--nav-glass-line)",
                      }}
                    />
                    {ts(`${section.id}.name`)}
                  </Link>
                </li>
              );
            })}
          </ul>
          <p
            className="mt-2 border-t px-3 pb-2 pt-3 text-[11px] font-medium uppercase tracking-[0.14em]"
            style={{
              color: "var(--nav-glass-muted)",
              borderColor: "var(--nav-glass-line)",
            }}
          >
            {tw("header.drawerPlatformLabel")}
          </p>
          <ul className="flex flex-col">
            <li>
              <Link
                href="/home"
                aria-current={isActive("/home") ? "page" : undefined}
                className="flex items-center rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-[var(--nav-glass-hover)]"
                style={{ color: "var(--nav-glass-ink)" }}
              >
                {tw("tabs.home")}
              </Link>
            </li>
            <li>
              <Link
                href="/subscription"
                aria-current={isActive("/subscription") ? "page" : undefined}
                className="flex items-center rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-[var(--nav-glass-hover)]"
                style={{ color: "var(--nav-glass-ink)" }}
              >
                {tw("header.drawerSubscription")}
              </Link>
            </li>
          </ul>
          <div
            className="mt-2 flex items-center justify-between gap-2 border-t pt-3"
            style={{ borderColor: "var(--nav-glass-line)" }}
          >
            <LocaleSwitch />
            <Link
              href="/home"
              onClick={() => setMenuOpen(false)}
              className="pl-nav-start inline-flex h-10 items-center rounded-full px-5 text-sm font-semibold"
              style={{ backgroundColor: "var(--site-accent)" }}
            >
              {tw("header.getStarted")}
            </Link>
          </div>
        </div>
      ) : null}
    </nav>
  );
}
