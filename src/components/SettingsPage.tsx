"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Bell, Info, Languages, Moon, Palette, Sun, UserRound } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { hasConsent, persistLocale, setThemeChoice } from "@/lib/consent";

/**
 * Settings — categories on the LEFT, their content on the RIGHT (one
 * visible panel at a time; on phones the category list becomes a
 * horizontal chip row above the panel).
 *
 * Base settings for now: account info (read-only), theme (light/dark,
 * follows the consent-aware persistence in lib/consent.ts), interface
 * language (az/en/ru) and three notification toggles (temporary —
 * persisted to localStorage only after cookie consent, exactly like
 * the theme).
 */

const CATS = [
  { id: "account", icon: UserRound },
  { id: "appearance", icon: Palette },
  { id: "language", icon: Languages },
  { id: "notifications", icon: Bell },
] as const;

type CatId = (typeof CATS)[number]["id"];

/** localStorage tier for the temporary notification toggles — written
 *  only after cookie consent, mirroring the theme policy. */
const NOTIFY_KEY = "pl-notify";
type NotifyKey = "reminders" | "digest" | "news";
type NotifyState = Record<NotifyKey, boolean>;
const DEFAULT_NOTIFY: NotifyState = { reminders: true, digest: true, news: false };

export type SettingsUser = { name: string | null; email: string };

export function SettingsPage({ user }: { user: SettingsUser }) {
  const t = useTranslations("settingsPage");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const [cat, setCat] = useState<CatId>("account");
  // null until mount — avoids a hydration mismatch on the pressed state.
  const [dark, setDark] = useState<boolean | null>(null);
  const [notify, setNotify] = useState<NotifyState>(DEFAULT_NOTIFY);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
    try {
      const raw = localStorage.getItem(NOTIFY_KEY);
      if (raw) setNotify({ ...DEFAULT_NOTIFY, ...(JSON.parse(raw) as Partial<NotifyState>) });
    } catch { /* storage unavailable */ }
  }, []);

  const chooseTheme = (next: boolean) => {
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    // Before consent the choice lives in memory for this visit only.
    setThemeChoice(next);
  };

  const chooseLocale = (next: string) => {
    if (next === locale) return;
    router.replace(pathname, { locale: next });
    if (hasConsent()) persistLocale(next);
  };

  const toggleNotify = (key: NotifyKey) => {
    setNotify((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (hasConsent()) {
        try { localStorage.setItem(NOTIFY_KEY, JSON.stringify(next)); } catch { /* unavailable */ }
      }
      return next;
    });
  };

  return (
    <div className="wrap">
      <header className="page-head">
        <p className="eyebrow"><i />{t("eyebrow")}</p>
        <h1 className="display sm">{t("title")}</h1>
        <p className="lede">{t("subtitle")}</p>
      </header>

      <div className="settings">
        {/* Left: category list (vertical on sm+, horizontal chips on phones) */}
        <nav className="set-nav" aria-label={t("navLabel")}>
          {CATS.map(({ id, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className="set-cat"
              aria-current={cat === id ? "true" : undefined}
              onClick={() => setCat(id)}
            >
              <Icon size={16} aria-hidden />
              {t(`cats.${id}`)}
            </button>
          ))}
        </nav>

        {/* Right: the active category's content */}
        <div className="set-body">
          {cat === "account" && (
            <section className="set-panel" aria-label={t("account.title")}>
              <div className="set-head">
                <h2 className="h3">{t("account.title")}</h2>
                <p>{t("account.subtitle")}</p>
              </div>
              <div className="set-rows">
                <div className="set-row">
                  <span className="set-info"><b>{t("account.name")}</b></span>
                  <span className="set-val">{user.name ?? "—"}</span>
                </div>
                <div className="set-row">
                  <span className="set-info"><b>{t("account.email")}</b></span>
                  <span className="set-val">{user.email}</span>
                </div>
                <div className="set-row">
                  <span className="set-info"><b>{t("account.plan")}</b></span>
                  <span className="set-val">{t("account.planFree")}</span>
                </div>
              </div>
              <p className="set-note"><Info size={15} aria-hidden />{t("account.note")}</p>
            </section>
          )}

          {cat === "appearance" && (
            <section className="set-panel" aria-label={t("appearance.title")}>
              <div className="set-head">
                <h2 className="h3">{t("appearance.title")}</h2>
                <p>{t("appearance.subtitle")}</p>
              </div>
              <div className="set-rows">
                <div className="set-row">
                  <span className="set-info">
                    <b>{t("appearance.theme")}</b>
                    <span>{t("appearance.themeHint")}</span>
                  </span>
                  <div className="seg" role="group" aria-label={t("appearance.theme")}>
                    <button type="button" aria-pressed={dark === false} onClick={() => chooseTheme(false)}>
                      <Sun size={13} aria-hidden />{t("appearance.light")}
                    </button>
                    <button type="button" aria-pressed={dark === true} onClick={() => chooseTheme(true)}>
                      <Moon size={13} aria-hidden />{t("appearance.dark")}
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}

          {cat === "language" && (
            <section className="set-panel" aria-label={t("language.title")}>
              <div className="set-head">
                <h2 className="h3">{t("language.title")}</h2>
                <p>{t("language.subtitle")}</p>
              </div>
              <div className="set-rows">
                <div className="set-row">
                  <span className="set-info">
                    <b>{t("language.title")}</b>
                    <span>{t("language.hint")}</span>
                  </span>
                  <div className="seg" role="group" aria-label={t("language.title")}>
                    {routing.locales.map((loc) => (
                      <button
                        key={loc}
                        type="button"
                        aria-pressed={loc === locale}
                        onClick={() => chooseLocale(loc)}
                      >
                        {loc}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          {cat === "notifications" && (
            <section className="set-panel" aria-label={t("notifications.title")}>
              <div className="set-head">
                <h2 className="h3">{t("notifications.title")}</h2>
                <p>{t("notifications.subtitle")}</p>
              </div>
              <div className="set-rows">
                {(["reminders", "digest", "news"] as const).map((key) => (
                  <div className="set-row" key={key}>
                    <span className="set-info">
                      <b>{t(`notifications.${key}`)}</b>
                      <span>{t(`notifications.${key}Hint`)}</span>
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={notify[key]}
                      aria-label={t(`notifications.${key}`)}
                      className="switch"
                      onClick={() => toggleNotify(key)}
                    />
                  </div>
                ))}
              </div>
              <p className="set-note"><Info size={15} aria-hidden />{t("notifications.note")}</p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
