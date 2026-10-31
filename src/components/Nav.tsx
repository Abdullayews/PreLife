"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Menu, User, X } from "lucide-react";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { sections } from "@/lib/shell";
import { ThemeToggle } from "./ThemeToggle";

function LocaleSwitch() {
  const t = useTranslations("welcomePage.header");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  return (
    <div role="group" aria-label={t("language")} className="seg">
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
  const th = useTranslations("welcomePage.header");
  const ts = useTranslations("sections");
  const pathname = usePathname();
  const [raised, setRaised] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setRaised(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => setOpen(false), [pathname]);

  const on = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="nav" data-raised={raised}>
      <nav aria-label={t("navAriaLabel")} className="nav-bar">
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

        <ul className="nav-links">
          {sections.map((s) => (
            <li key={s.id}>
              <Link href={s.href} aria-current={on(s.href) ? "page" : undefined}>
                {ts(`${s.id}.name`)}
              </Link>
            </li>
          ))}
        </ul>

        <div className="nav-tools">
          <span className="hide-sm"><LocaleSwitch /></span>
          <ThemeToggle />
          <Link href="/home" className="icon-btn hide-md" aria-label={th("account")}>
            <User size={18} aria-hidden />
          </Link>
          <Link href="/home" className="btn btn-sm hide-md">{th("getStarted")}</Link>
        </div>
      </nav>

      {open && (
        <div className="sheet">
          <p className="eyebrow">{th("drawerSectionsLabel")}</p>
          <ul>
            {sections.map((s) => (
              <li key={s.id}>
                <Link href={s.href} aria-current={on(s.href) ? "page" : undefined}>
                  {ts(`${s.id}.name`)}
                </Link>
              </li>
            ))}
          </ul>
          <p className="eyebrow">{th("drawerPlatformLabel")}</p>
          <ul>
            <li><Link href="/subscription" aria-current={on("/subscription") ? "page" : undefined}>{th("drawerSubscription")}</Link></li>
            <li><Link href="/home" aria-current={on("/home") ? "page" : undefined}>{th("account")}</Link></li>
          </ul>
          <div className="sheet-row">
            <LocaleSwitch />
            <Link href="/home" className="btn btn-sm">{th("getStarted")}</Link>
          </div>
        </div>
      )}
    </header>
  );
}
