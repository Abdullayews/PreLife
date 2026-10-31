"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { capstoneSections, type CapstoneSection } from "@/lib/capstone";
import { LangPill } from "@/components/lang-pill";

/**
 * Home-world header (home dashboard + section + subscription pages).
 * Deliberately the opposite of the welcome header: the wordmark sits LEFT
 * and the capstone section tabs run TOP-RIGHT (Ultrahuman pill anatomy with
 * per-section capstone colors for the active state). No Welcome|Home pair
 * and no hamburger here — the wordmark always returns to the dashboard.
 * Mobile: the tabs become a right-aligned, horizontally scrollable rail.
 */
export function HomeHeader() {
  const tw = useTranslations("welcomePage");
  const th = useTranslations("homePage");
  const pathname = usePathname();

  function renderTab(s: CapstoneSection, compact = false) {
    const Icon = s.icon;
    const active = pathname === s.href || pathname.startsWith(`${s.href}/`);
    return (
      <Link
        key={s.id}
        href={s.href}
        aria-current={active ? "page" : undefined}
        style={active ? { backgroundColor: s.tint, color: s.accent } : undefined}
        className={cn(
          "inline-flex shrink-0 items-center rounded-full transition-colors",
          compact
            ? "gap-1 px-3 py-1 text-xs"
            : "gap-1.5 px-3.5 py-1.5 text-sm",
          active
            ? "font-semibold"
            : "font-medium text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
        )}
      >
        {compact ? null : <Icon className="size-4" aria-hidden="true" />}
        {tw(`modules.cards.${s.id}.name`)}
      </Link>
    );
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        {/* Top row: wordmark left, everything else right */}
        <div className="grid h-16 grid-cols-[1fr_auto] items-center md:h-[72px]">
          <Link
            href="/home"
            aria-label={tw("brand")}
            className="text-lg font-bold tracking-tight"
          >
            {tw("brand")}
          </Link>

          {/* Desktop: section tabs + language, packed to the top-right */}
          <div className="hidden items-center justify-end gap-2 md:flex">
            <nav
              aria-label={th("header.navLabel")}
              className="flex items-center gap-1"
            >
              {capstoneSections.map((s) => renderTab(s))}
            </nav>
            <LangPill label={th("header.language")} />
          </div>

          {/* Mobile: language only in the top row */}
          <div className="flex justify-end md:hidden">
            <LangPill label={th("header.language")} />
          </div>
        </div>

        {/* Mobile: right-aligned scrollable tab rail under the top row.
            Compact text-only pills so all locales fit at 390px. */}
        <nav
          aria-label={th("header.navLabel")}
          className="mb-2.5 flex items-center justify-end gap-1 overflow-x-auto pb-1 md:hidden"
        >
          {capstoneSections.map((s) => renderTab(s, true))}
        </nav>
      </div>
    </header>
  );
}
