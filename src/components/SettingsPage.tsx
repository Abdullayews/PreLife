"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { apiUrl } from "@/lib/api-url";
import {
  Bell, Briefcase, Check, Gamepad2, Headphones, Home, Info, Languages, Laptop,
  LogOut, Monitor, Moon, Palette, Pencil, Smartphone, Sun, Tablet, Tv, UserRound,
  Watch, X, type LucideIcon,
} from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { hasConsent, persistLocale, setThemeChoice } from "@/lib/consent";
import { saveUserPref } from "@/lib/user-prefs";
import { DEVICE_ICON_KEYS } from "@/lib/devices";

/**
 * Settings — categories on the LEFT, their content on the RIGHT (one
 * visible panel at a time; on phones the category list becomes a
 * horizontal chip row above the panel).
 *
 * Base settings: account info (read-only), devices (active sessions with
 * per-device name + icon), theme (light/dark, consent-aware persistence),
 * interface language (az/en/ru) and three notification toggles.
 */

const CATS = [
  { id: "account", icon: UserRound },
  { id: "devices", icon: Monitor },
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

/* ── Devices (Settings → Devices) ──────────────────────────────────────── */

const DEVICE_ICONS: Record<string, LucideIcon> = {
  monitor: Monitor, laptop: Laptop, smartphone: Smartphone, tablet: Tablet,
  watch: Watch, tv: Tv, gamepad: Gamepad2, headphones: Headphones,
  briefcase: Briefcase, home: Home,
};

type Device = {
  id: string;
  name: string;
  icon: string;
  current: boolean;
  createdAt: string;
  lastUsedAt: string;
};

/** "5 dəqiqə əvvəl" / "5 minutes ago" — client-side relative time. */
function relTime(iso: string, locale: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 60_000) return rtf.format(0, "minute");
  const min = Math.round(diff / 60_000);
  if (abs < 3_600_000) return rtf.format(-min, "minute");
  const hours = Math.round(min / 60);
  if (abs < 86_400_000) return rtf.format(-hours, "hour");
  const days = Math.round(hours / 24);
  if (abs < 2_592_000_000) return rtf.format(-days, "day");
  return rtf.format(-Math.round(days / 30), "month");
}

function DevicesPanel() {
  const t = useTranslations("settingsPage.devices");
  const locale = useLocale();
  const router = useRouter();

  const [devices, setDevices] = useState<Device[] | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editIcon, setEditIcon] = useState<string>("monitor");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/api/devices"), { cache: "no-store" });
      if (!res.ok) throw new Error();
      const body = (await res.json()) as { devices: Device[] };
      setDevices(body.devices);
      setError(false);
    } catch {
      setDevices([]);
      setError(true);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const startEdit = (d: Device) => {
    setEditingId(d.id);
    setEditName(d.name);
    setEditIcon(d.icon);
  };

  const saveEdit = async () => {
    if (!editingId || busy) return;
    setBusy(true);
    setError(false);
    try {
      const res = await fetch(apiUrl(`/api/devices/${editingId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, icon: editIcon }),
      });
      if (!res.ok) throw new Error();
      setEditingId(null);
      await load();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (d: Device) => {
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      if (d.current) {
        // Signing THIS device out — full logout, back to the welcome page.
        await fetch(apiUrl("/api/auth/logout"), { method: "POST" });
        router.push("/welcome");
        router.refresh();
        return;
      }
      const res = await fetch(apiUrl(`/api/devices/${d.id}`), { method: "DELETE" });
      if (!res.ok) throw new Error();
      await load();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="set-panel" aria-label={t("title")}>
      <div className="set-head">
        <h2 className="h3">{t("title")}</h2>
        <p>{t("subtitle")}</p>
      </div>

      {error && <p className="field-error" role="alert">{t("error")}</p>}

      <div className="device-list">
        {devices === null ? (
          <p className="device-meta" aria-busy="true">{t("loading")}</p>
        ) : (
          devices.map((d) =>
            editingId === d.id ? (
              <div key={d.id} className="device-edit">
                <div className="field">
                  <label htmlFor={`dev-name-${d.id}`}>{t("nameLabel")}</label>
                  <input
                    id={`dev-name-${d.id}`}
                    type="text"
                    value={editName}
                    maxLength={40}
                    placeholder={d.name}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditingId(null); }}
                  />
                </div>
                <div className="field">
                  <span id={`dev-ico-${d.id}`} className="device-grid-label">{t("iconLabel")}</span>
                  <div className="icon-grid" role="group" aria-labelledby={`dev-ico-${d.id}`}>
                    {DEVICE_ICON_KEYS.map((key) => {
                      const Icon = DEVICE_ICONS[key];
                      return (
                        <button
                          key={key}
                          type="button"
                          aria-pressed={editIcon === key}
                          aria-label={t(`icons.${key}`)}
                          title={t(`icons.${key}`)}
                          onClick={() => setEditIcon(key)}
                        >
                          <Icon size={17} aria-hidden />
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="device-edit-actions">
                  <button type="button" className="btn btn-sm" onClick={saveEdit} disabled={busy || !editName.trim()}>
                    <Check size={14} aria-hidden />{t("save")}
                  </button>
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => setEditingId(null)} disabled={busy}>
                    <X size={14} aria-hidden />{t("cancel")}
                  </button>
                </div>
              </div>
            ) : (
              <div key={d.id} className="device">
                <span className="device-ico" aria-hidden>
                  {(() => { const Icon = DEVICE_ICONS[d.icon] ?? Monitor; return <Icon size={20} />; })()}
                </span>
                <div className="device-info">
                  <span className="device-name">
                    {d.name}
                    {d.current && <span className="device-badge">{t("current")}</span>}
                  </span>
                  <span className="device-meta">{t("lastActive", { time: relTime(d.lastUsedAt, locale) })}</span>
                </div>
                <div className="device-actions">
                  <button type="button" className="icon-btn" aria-label={t("edit")} title={t("edit")} onClick={() => startEdit(d)}>
                    <Pencil size={15} aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={d.current ? t("signOutCurrent") : t("signOut")}
                    title={d.current ? t("signOutCurrent") : t("signOut")}
                    onClick={() => revoke(d)}
                    disabled={busy}
                  >
                    <LogOut size={15} aria-hidden />
                  </button>
                </div>
              </div>
            ),
          )
        )}
      </div>

      <p className="set-note"><Info size={15} aria-hidden />{t("note")}</p>
    </section>
  );
}

/* ── The settings shell ────────────────────────────────────────────────── */

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
    // Account tier (v3.2): Settings is signed-in only — always sync the
    // choice to the profiles row too.
    saveUserPref({ theme: next ? "dark" : "light" });
  };

  const chooseLocale = (next: string) => {
    if (next === locale) return;
    router.replace(pathname, { locale: next });
    if (hasConsent()) persistLocale(next);
    // Account tier (v3.2) — Settings is signed-in only.
    saveUserPref({ locale: next });
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

          {cat === "devices" && <DevicesPanel />}

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
