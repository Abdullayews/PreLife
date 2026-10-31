"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { Menu, User, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { capstoneSections } from "@/lib/capstone";
import { LangPill } from "@/components/lang-pill";
import { StartCta } from "@/components/welcome/start-cta";

/**
 * Welcome-world top bar — an exact structural replica of the ultrahuman.com
 * header (measured 2026-10): full-width solid bar at the top of the page that
 * morphs into a floating frosted-glass pill (28px radius, 62% white, 20px
 * blur, inset 5vw) once the page scrolls. Left: hamburger + section links.
 * Center: wordmark.
 * Right: region pill, account icon, slim royal-blue pill CTA.
 */

const SCROLL_AT = 24;
/* Ultrahuman-measured values */
const PILL_BG = "bg-white/[0.62]";
const PILL_SHADOW =
  "shadow-[0_2px_10px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.03)]";
const EASE = "ease-[cubic-bezier(0.22,1,0.36,1)]";
const CTA_BLUE = "bg-[#112BAF] text-white hover:bg-[#0D2187]";

export function WelcomeHeader() {
  const t = useTranslations("welcomePage");
  const ts = useTranslations("sections");
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > SCROLL_AT);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-50">
        {/* Bar — full-width solid at top, floating glass pill when scrolled */}
        <div
          className={cn(
            "transition-[padding] duration-500",
            EASE,
            scrolled ? "px-[max(1rem,5vw)] pt-3" : "px-0 pt-0",
          )}
        >
          <header
            className={cn(
              "h-[57px] transition-[background-color,box-shadow,border-radius] duration-500",
              EASE,
              scrolled
                ? cn(
                    "rounded-[28px] backdrop-blur-[20px]",
                    PILL_BG,
                    PILL_SHADOW,
                  )
                : "bg-white",
            )}
          >
            <div className="relative flex h-full items-center px-6">
              {/* Left: hamburger + section links (+ wordmark on mobile) */}
              <div className="flex items-center gap-3 md:gap-6">
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls="welcome-nav-drawer"
                  aria-label={t("header.menu")}
                  onClick={() => setOpen(true)}
                  className="flex size-8 shrink-0 items-center justify-center text-[#111] transition-opacity hover:opacity-60"
                >
                  <Menu className="size-[22px]" strokeWidth={1.5} aria-hidden="true" />
                </button>
                <Link
                  href="/welcome"
                  aria-label={t("brand")}
                  className="text-[17px] font-semibold tracking-[0.14em] text-[#111] md:hidden"
                >
                  {t("brand")}
                </Link>
                <nav
                  aria-label={t("navLabel")}
                  className="hidden items-center gap-6 md:flex"
                >
                  {capstoneSections.map((section) => (
                    <Link
                      key={section.id}
                      href={section.href}
                      aria-current={isActive(section.href) ? "page" : undefined}
                      className={cn(
                        "flex h-9 items-center px-2 text-[13px] font-normal leading-6 text-[#111] transition-opacity hover:opacity-60",
                        isActive(section.href) && "font-medium",
                      )}
                    >
                      {ts(`${section.id}.name`)}
                    </Link>
                  ))}
                </nav>
              </div>

              {/* Center: wordmark (desktop only — absolute center) */}
              <Link
                href="/welcome"
                aria-label={t("brand")}
                className="absolute left-1/2 hidden -translate-x-1/2 text-[17px] font-semibold tracking-[0.14em] text-[#111] md:inline-flex"
              >
                {t("brand")}
              </Link>

              {/* Right: region pill + account + CTA */}
              <div className="ml-auto flex items-center gap-3 md:gap-6">
                <LangPill
                  variant="region"
                  label={t("header.language")}
                />
                <Link
                  href="/home"
                  aria-label={t("header.account")}
                  className="hidden size-8 items-center justify-center text-[#111] transition-opacity hover:opacity-60 sm:inline-flex"
                >
                  <User className="size-[18px]" strokeWidth={1.5} aria-hidden="true" />
                </Link>
                {/* TEST-ONLY (per user): Get started opens Home directly — the
                    real onboarding/account flow replaces this in a later phase. */}
                <StartCta
                  label={t("header.getStarted")}
                  size="sm"
                  withArrow={false}
                  className={cn(
                    "h-9 rounded-full border-0 px-6 text-[13px] font-normal",
                    CTA_BLUE,
                  )}
                />
              </div>
            </div>
          </header>
        </div>
      </div>

      {/* Navigation drawer — frosted sheet (Ultrahuman drawer) */}
      {open && (
        <div id="welcome-nav-drawer" className="fixed inset-0 z-[60]">
          <button
            type="button"
            aria-label={t("header.close")}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/20"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("header.menu")}
            className="uh-drawer absolute inset-y-0 left-0 flex w-[320px] max-w-[85vw] flex-col overflow-y-auto bg-white/[0.72] shadow-2xl backdrop-blur-[20px]"
          >
            <div className="flex h-14 shrink-0 items-center justify-between px-5">
              <span className="text-[17px] font-semibold tracking-[0.14em] text-[#111]">
                {t("brand")}
              </span>
              <button
                type="button"
                aria-label={t("header.close")}
                onClick={() => setOpen(false)}
                className="flex size-8 items-center justify-center text-[#111] transition-opacity hover:opacity-60"
              >
                <X className="size-[22px]" strokeWidth={1.5} aria-hidden="true" />
              </button>
            </div>

            <nav
              aria-label={t("header.drawerSectionsLabel")}
              className="flex flex-col gap-1 px-4 pb-4 pt-2"
            >
              <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-[0.14em] text-black/50">
                {t("header.drawerSectionsLabel")}
              </p>
              {capstoneSections.map((section) => (
                <Link
                  key={section.id}
                  href={section.href}
                  onClick={() => setOpen(false)}
                  aria-current={isActive(section.href) ? "page" : undefined}
                  className="flex items-center gap-3 rounded-xl px-2 py-2.5 text-[15px] font-medium text-[#111] transition-colors hover:bg-black/5"
                >
                  <span
                    aria-hidden="true"
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: section.accent }}
                  />
                  {ts(`${section.id}.name`)}
                </Link>
              ))}
            </nav>

            <nav
              aria-label={t("header.drawerPlatformLabel")}
              className="flex flex-col gap-1 px-4 pb-6"
            >
              <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-[0.14em] text-black/50">
                {t("header.drawerPlatformLabel")}
              </p>
              <Link
                href="/welcome"
                onClick={() => setOpen(false)}
                aria-current={isActive("/welcome") ? "page" : undefined}
                className="flex items-center rounded-xl px-2 py-2.5 text-[15px] font-medium text-[#111] transition-colors hover:bg-black/5"
              >
                {t("tabs.welcome")}
              </Link>
              <Link
                href="/home"
                onClick={() => setOpen(false)}
                aria-current={isActive("/home") ? "page" : undefined}
                className="flex items-center rounded-xl px-2 py-2.5 text-[15px] font-medium text-[#111] transition-colors hover:bg-black/5"
              >
                {t("tabs.home")}
              </Link>
              <Link
                href="/subscription"
                onClick={() => setOpen(false)}
                aria-current={isActive("/subscription") ? "page" : undefined}
                className="flex items-center rounded-xl px-2 py-2.5 text-[15px] font-medium text-[#111] transition-colors hover:bg-black/5"
              >
                {t("header.drawerSubscription")}
              </Link>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
