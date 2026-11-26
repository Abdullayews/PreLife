"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { apiUrl } from "@/lib/api-url";
import {
  Bell, BellRing, Briefcase, Check, Download, Gamepad2, Globe, Headphones, Home, Info, Languages, Laptop,
  LoaderCircle, LogOut, MapPin, Monitor, Moon, Palette, Pencil, ShieldCheck, Smartphone, Sun, Tablet, Trash2, Tv,
  UserRound, Watch, X, type LucideIcon,
} from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { hasConsent, persistLocale, setThemeChoice } from "@/lib/consent";
import { saveUserPref } from "@/lib/user-prefs";
import { notifPermission, requestNotifPermission, showNotif, type NotifPermission } from "@/lib/notifications";
import { DEVICE_ICON_KEYS } from "@/lib/devices";
import { fetchConsents, setConsent, type ConsentMap, type DataScope } from "@/lib/data-consent";
import { toast } from "@/components/Toaster";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { AccountRole } from "@/lib/auth";

/**
 * Settings — categories on the LEFT, their content on the RIGHT (one
 * visible panel at a time; on phones the category list becomes a
 * horizontal chip row above the panel).
 *
 * Base settings: account info (read-only + log out), devices (active
 * sessions with per-device name + icon), theme (light/dark,
 * consent-aware persistence), interface language (az/en/ru), content
 * location (global / Azerbaijan only — v3.4) and notifications — the
 * browser permission (Notifications API) plus the account-tier channel
 * opt-ins (v3.8).
 */

const CATS = [
  { id: "account", icon: UserRound },
  { id: "devices", icon: Monitor },
  { id: "privacy", icon: ShieldCheck },
  { id: "appearance", icon: Palette },
  { id: "language", icon: Languages },
  { id: "location", icon: MapPin },
  { id: "notifications", icon: Bell },
] as const;

type CatId = (typeof CATS)[number]["id"];

/** The account-tier notification channels (v3.8) — profiles.notify_*.
 *  The browser permission itself is a separate device-level gate (see
 *  lib/notifications.ts); these are the member's channel opt-ins. */
type NotifyKey = "reminders" | "digest" | "news";
type NotifyState = Record<NotifyKey, boolean>;
const NOTIFY_DEFAULTS: NotifyState = { reminders: true, digest: true, news: false };
const NOTIFY_FIELD: Record<NotifyKey, string> = {
  reminders: "notifyReminders",
  digest: "notifyDigest",
  news: "notifyNews",
};

export type SettingsUser = { name: string | null; email: string; role: AccountRole };

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
  // The pending revoke — signing a device out ends its session, so the
  // action asks first (the shared confirm guard).
  const [askDev, setAskDev] = useState<Device | null>(null);

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
                  <fieldset className="icon-grid" aria-labelledby={`dev-ico-${d.id}`}>
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
                  </fieldset>
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
                    onClick={() => setAskDev(d)}
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

      <ConfirmDialog
        open={askDev !== null}
        onClose={() => setAskDev(null)}
        onConfirm={() => {
          const d = askDev;
          setAskDev(null);
          if (d) void revoke(d);
        }}
        message={askDev ? t(askDev.current ? "revokeCurrentConfirm" : "revokeConfirm") : ""}
        confirmLabel={askDev ? t(askDev.current ? "signOutCurrent" : "signOut") : ""}
        busy={busy}
      />
    </section>
  );
}

/* ── Privacy (Settings → Privacy: consents, export, deletion) ─────── */

const PRIVACY_SCOPES: DataScope[] = ["mood", "journal", "quiz", "ai"];

/** The data-rights panel: per-scope consent switches (withdrawable),
 *  the JSON data export (access + portability) and the self-service
 *  account deletion (erasure) with a typed confirmation + password
 *  re-check for password accounts. */
function PrivacyPanel() {
  const t = useTranslations("settingsPage");
  const tp = useTranslations("settingsPage.privacy");
  const router = useRouter();

  const [consents, setConsents] = useState<ConsentMap | null>(null);
  const [busyScope, setBusyScope] = useState<DataScope | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const map = await fetchConsents();
    setConsents(map);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const toggle = async (scope: DataScope) => {
    if (busyScope || consents === null) return;
    setBusyScope(scope);
    const next = await setConsent(scope, !consents[scope]);
    if (next === null) {
      toast(t("actionFailed"));
    } else {
      setConsents(next);
    }
    setBusyScope(null);
  };

  const exportData = async () => {
    if (exporting) return;
    setExporting(true);
    setExportError(false);
    try {
      const res = await fetch(apiUrl("/api/me/export"), { cache: "no-store" });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `prelife-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast(tp("exportDone"));
    } catch {
      setExportError(true);
    } finally {
      setExporting(false);
    }
  };

  const deleteAccount = async () => {
    if (deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(apiUrl("/api/me"), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true, password: password || undefined }),
      });
      if (res.ok) {
        toast(tp("deleteDone"));
        router.replace("/welcome");
        router.refresh();
        return;
      }
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      const code = body?.error ?? "generic";
      setDeleteError(tp.has(`deleteFail.${code}`) ? tp(`deleteFail.${code}`) : tp("deleteFail.generic"));
    } catch {
      setDeleteError(tp("deleteFail.generic"));
    } finally {
      setDeleting(false);
    }
  };

  const wordOk = confirmText.trim().toUpperCase() === tp("deleteWord").trim().toUpperCase();

  return (
    <>
      <section className="set-panel" aria-label={tp("consentsTitle")}>
        <div className="set-head">
          <h2 className="h3">{tp("consentsTitle")}</h2>
          <p>{tp("consentsSubtitle")}</p>
        </div>
        <div className="set-rows">
          {PRIVACY_SCOPES.map((scope) => (
            <div className="set-row" key={scope}>
              <span className="set-info">
                <b>{tp(`scopes.${scope}.title`)}</b>
                <span>{tp(`scopes.${scope}.desc`)}</span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={consents?.[scope] ?? false}
                aria-label={tp(`scopes.${scope}.title`)}
                className="switch"
                onClick={() => void toggle(scope)}
                disabled={consents === null || busyScope !== null}
              />
            </div>
          ))}
        </div>
        <p className="set-note"><Info size={15} aria-hidden />{tp("consentsNote")}</p>
      </section>

      <section className="set-panel" aria-label={tp("exportTitle")}>
        <div className="set-head">
          <h2 className="h3">{tp("exportTitle")}</h2>
          <p>{tp("exportSubtitle")}</p>
        </div>
        {exportError && <p className="field-error" role="alert">{tp("exportFail")}</p>}
        <button type="button" className="btn btn-sm" onClick={() => void exportData()} disabled={exporting}>
          {exporting ? <LoaderCircle size={14} className="spin" aria-hidden /> : <Download size={14} aria-hidden />}
          {tp("exportBtn")}
        </button>
        <p className="set-note"><Info size={15} aria-hidden />{tp("exportNote")}</p>
      </section>

      <section className="set-panel set-danger" aria-label={tp("deleteTitle")}>
        <div className="set-head">
          <h2 className="h3">{tp("deleteTitle")}</h2>
          <p>{tp("deleteSubtitle")}</p>
        </div>
        {deleteError && <p className="field-error" role="alert">{deleteError}</p>}
        <div className="set-rows">
          <div className="set-row">
            <span className="set-info">
              <b>{tp("deleteWordLabel")}</b>
              <span>{tp("deleteWordHint")}</span>
            </span>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              aria-label={tp("deleteWordLabel")}
              autoComplete="off"
              maxLength={20}
              className="set-input"
            />
          </div>
          <div className="set-row">
            <span className="set-info">
              <b>{tp("deletePasswordLabel")}</b>
              <span>{tp("deletePasswordHint")}</span>
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-label={tp("deletePasswordLabel")}
              autoComplete="current-password"
              maxLength={100}
              className="set-input"
            />
          </div>
        </div>
        <button type="button" className="btn btn-sm btn-danger" onClick={() => void deleteAccount()} disabled={deleting || !wordOk}>
          {deleting ? <LoaderCircle size={14} className="spin" aria-hidden /> : <Trash2 size={14} aria-hidden />}
          {tp("deleteBtn")}
        </button>
        <p className="set-note"><Info size={15} aria-hidden />{tp("deleteNote")}</p>
      </section>
    </>
  );
}

/* ── Location (Settings → Location) ───────────────────────────────────── */

const LOCATION_OPTIONS = [
  { id: "global", icon: Globe, titleKey: "global", descKey: "globalDesc" },
  { id: "az", icon: MapPin, titleKey: "az", descKey: "azDesc" },
] as const;

/** The content-scope choice (v3.4): which locations the content sections
 *  show — everything, or Azerbaijan only. Saved on the profiles row and
 *  mirrored to the session rows, so every server-rendered page filters
 *  halls / venues / stores / psychologists by it. */
function LocationPanel() {
  const t = useTranslations("settingsPage");
  const tl = useTranslations("settingsPage.location");
  const router = useRouter();

  // null until the profile row loads — the cards stay inert for that
  // first beat and no hydration mismatch can flash a wrong checked state.
  const [loc, setLoc] = useState<"global" | "az" | null>(null);
  const [busy, setBusy] = useState<"global" | "az" | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(apiUrl("/api/me/preferences"), { cache: "no-store" });
        if (!res.ok) throw new Error();
        const body = (await res.json()) as { contentLocation?: string };
        if (alive) setLoc(body.contentLocation === "az" ? "az" : "global");
      } catch {
        // Offline / signed out — the DB default is global.
        if (alive) setLoc("global");
      }
    })();
    return () => { alive = false; };
  }, []);

  const choose = async (next: "global" | "az") => {
    if (busy !== null || next === loc) return;
    setBusy(next);
    setError(false);
    try {
      const res = await fetch(apiUrl("/api/me/preferences"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentLocation: next }),
      });
      if (!res.ok) throw new Error();
      setLoc(next);
      toast(tl("saved"));
      // The choice rides on the session rows — refresh re-renders the
      // server pages so their content is filtered for it right away.
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="set-panel" aria-label={tl("title")}>
      <div className="set-head">
        <h2 className="h3">{tl("title")}</h2>
        <p>{tl("subtitle")}</p>
      </div>

      {error && <p className="field-error" role="alert">{t("actionFailed")}</p>}

      <div className="subtiers" role="radiogroup" aria-label={tl("title")}>
        {LOCATION_OPTIONS.map(({ id, icon: Icon, titleKey, descKey }) => {
          const active = loc === id;
          const saving = busy === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={active}
              className="card subtier"
              data-active={active || undefined}
              onClick={() => choose(id)}
              disabled={loc === null || busy !== null}
            >
              <span className="card-top">
                <span className="chip-ico tinted"><Icon size={20} aria-hidden /></span>
                <b>{tl(titleKey)}</b>
                {saving
                  ? <LoaderCircle size={16} className="spin" aria-hidden />
                  : active && <Check size={16} aria-hidden />}
              </span>
              <p>{tl(descKey)}</p>
            </button>
          );
        })}
      </div>

      <p className="set-note"><Info size={15} aria-hidden />{tl("hint")}</p>
    </section>
  );
}

/* ── Notifications (Settings → Notifications) ─────────────────────────── */

/** The notification panel — two layers, one screen:
 *  1. The BROWSER PERMISSION (Notifications API): a status row with the
 *     Ask / Test button. Asking only ever happens from a click (the
 *     request needs the user gesture); a denied answer can only be lifted
 *     from the browser's own site settings, so that state shows the
 *     unblock instructions instead of re-prompting.
 *  2. The CHANNEL OPT-INS (v3.8 — profiles.notify_*): the three account
 *     toggles, synced through /api/me/preferences so they follow the
 *     member across devices. Turning a channel ON while the browser has
 *     not been asked yet asks for the permission first — the opt-in only
 *     lands when notifications can actually appear. */
function NotificationsPanel() {
  const tn = useTranslations("settingsPage.notifications");

  // null until the profile row loads — the switches stay inert for that
  // first beat (no wrong checked state can flash).
  const [notify, setNotify] = useState<NotifyState | null>(null);
  // null until mount — the permission status renders client-side only.
  const [perm, setPerm] = useState<NotifPermission | null>(null);
  const [busy, setBusy] = useState<NotifyKey | "ask" | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    setPerm(notifPermission());
    let alive = true;
    (async () => {
      try {
        const res = await fetch(apiUrl("/api/me/preferences"), { cache: "no-store" });
        if (!res.ok) throw new Error();
        const body = (await res.json()) as {
          notifyReminders?: boolean;
          notifyDigest?: boolean;
          notifyNews?: boolean;
        };
        if (alive) {
          setNotify({
            reminders: body.notifyReminders ?? true,
            digest: body.notifyDigest ?? true,
            news: body.notifyNews ?? false,
          });
        }
      } catch {
        // Offline / signed out — the DB defaults apply.
        if (alive) setNotify(NOTIFY_DEFAULTS);
      }
    })();
    return () => { alive = false; };
  }, []);

  const persist = async (key: NotifyKey, next: boolean): Promise<boolean> => {
    try {
      const res = await fetch(apiUrl("/api/me/preferences"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [NOTIFY_FIELD[key]]: next }),
      });
      return res.ok;
    } catch {
      return false;
    }
  };

  const toggle = async (key: NotifyKey) => {
    if (notify === null || busy !== null) return;
    const next = !notify[key];
    // Turning a channel ON needs the browser to actually be able to show
    // notifications — ask while the click gesture is still warm. A "denied"
    // answer leaves the switch off (the channel could never fire).
    if (next && perm === "default") {
      setBusy("ask");
      const result = await requestNotifPermission();
      setPerm(result);
      setBusy(null);
      if (result !== "granted") {
        toast(result === "denied" ? tn("permission.deniedToast") : tn("permission.dismissedToast"), "error");
        return;
      }
    }
    setBusy(key);
    setError(false);
    const ok = await persist(key, next);
    setBusy(null);
    if (!ok) {
      setError(true);
      return;
    }
    setNotify((prev) => (prev ? { ...prev, [key]: next } : prev));
    if (next && perm === "denied") toast(tn("permission.deniedToast"), "error");
  };

  const ask = async () => {
    if (busy !== null) return;
    setBusy("ask");
    const result = await requestNotifPermission();
    setPerm(result);
    setBusy(null);
    if (result === "granted") toast(tn("permission.grantedToast"));
    else if (result === "denied") toast(tn("permission.deniedToast"), "error");
  };

  const test = () => {
    if (showNotif(tn("permission.testTitle"), tn("permission.testBody")) === "failed") {
      toast(tn("permission.testFail"), "error");
    }
  };

  const note =
    perm === "denied" ? tn("permission.deniedHint")
    : perm === "unsupported" ? tn("permission.unsupportedHint")
    : perm === "default" ? tn("permission.defaultHint")
    : tn("note");

  return (
    <section className="set-panel" aria-label={tn("title")}>
      <div className="set-head">
        <h2 className="h3">{tn("title")}</h2>
        <p>{tn("subtitle")}</p>
      </div>

      {error && <p className="field-error" role="alert">{tn("saveFail")}</p>}

      <div className="set-rows">
        <div className="set-row">
          <span className="set-info">
            <b>{tn("permission.title")}</b>
            <span>{perm === null ? tn("permission.checking") : tn(`permission.status.${perm}`)}</span>
          </span>
          {perm === "default" && (
            <button type="button" className="btn btn-sm" onClick={() => void ask()} disabled={busy !== null}>
              {busy === "ask" ? <LoaderCircle size={14} className="spin" aria-hidden /> : <BellRing size={14} aria-hidden />}
              {tn("permission.allow")}
            </button>
          )}
          {perm === "granted" && (
            <button type="button" className="btn btn-sm" onClick={test}>
              {tn("permission.test")}
            </button>
          )}
        </div>

        {(Object.keys(NOTIFY_FIELD) as NotifyKey[]).map((key) => (
          <div className="set-row" key={key}>
            <span className="set-info">
              <b>{tn(key)}</b>
              <span>{tn(`${key}Hint`)}</span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={notify?.[key] ?? false}
              aria-label={tn(key)}
              className="switch"
              onClick={() => void toggle(key)}
              disabled={notify === null || busy !== null}
            />
          </div>
        ))}
      </div>

      <p className="set-note"><Info size={15} aria-hidden />{note}</p>
    </section>
  );
}

/* ── The settings shell ────────────────────────────────────────────────── */

export function SettingsPage({ user }: { user: SettingsUser }) {
  const t = useTranslations("settingsPage");
  const tl = useTranslations("settingsPage.location");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const [cat, setCat] = useState<CatId>("account");
  // null until mount — avoids a hydration mismatch on the pressed state.
  const [dark, setDark] = useState<boolean | null>(null);
  const [motion, setMotion] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  useEffect(() => {
    setMotion(document.documentElement.classList.contains("reduce-motion"));
  }, []);

  const chooseMotion = () => {
    const next = !motion;
    setMotion(next);
    document.documentElement.classList.toggle("reduce-motion", next);
    // Local tier (cross-visit, consent-gated) + the account tier.
    try {
      if (document.cookie.split(";").some((c) => c.trim().startsWith("pl_cookies="))) {
        localStorage.setItem("pl-motion", next ? "off" : "on");
      }
    } catch { /* storage unavailable */ }
    saveUserPref({ reduceMotion: next });
  };

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
    // Keep the query (?tab= etc.) across the language switch.
    const query = typeof window === "undefined" ? "" : window.location.search;
    router.replace(query ? `${pathname}${query}` : pathname, { locale: next });
    if (hasConsent()) persistLocale(next);
    // Account tier (v3.2) — Settings is signed-in only.
    saveUserPref({ locale: next });
  };

  /* Log out — lives HERE since the rail dropped it (v6): ends this
   * device's session and returns to the welcome surface. */
  const logout = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await fetch(apiUrl("/api/auth/logout"), { method: "POST" });
      router.replace("/welcome");
      router.refresh();
    } finally {
      setBusy(false);
    }
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
              {/* cats.location has no key of its own — the section title
               * ("Location") serves as the nav label. */}
              {id === "location" ? tl("title") : t(`cats.${id}`)}
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
                  <span className="set-info"><b>{t("account.role")}</b></span>
                  <span className="set-val">
                    {t.has(`account.role_${user.role}`) ? t(`account.role_${user.role}`) : t("account.role_user")}
                  </span>
                </div>
                <div className="set-row">
                  <span className="set-info"><b>{t("account.plan")}</b></span>
                  <span className="set-val">{t("account.planFree")}</span>
                </div>
                <div className="set-row">
                  <span className="set-info">
                    <b>{t("account.editProfile")}</b>
                  </span>
                  <Link href="/profile" className="btn btn-sm">
                    <UserRound size={15} aria-hidden />{t("account.editProfile")}
                  </Link>
                </div>
                <div className="set-row">
                  <span className="set-info">
                    <b>{t("account.logout")}</b>
                    <span>{t("account.logoutHint")}</span>
                  </span>
                  <button type="button" className="set-logout" onClick={logout} disabled={busy}>
                    <LogOut size={15} aria-hidden />{t("account.logout")}
                  </button>
                </div>
              </div>
              <p className="set-note"><Info size={15} aria-hidden />{t("account.note")}</p>
            </section>
          )}

          {cat === "devices" && <DevicesPanel />}
          {cat === "privacy" && <PrivacyPanel />}

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
                  <fieldset className="seg" aria-label={t("appearance.theme")}>
                    <button type="button" aria-pressed={dark === false} onClick={() => chooseTheme(false)}>
                      <Sun size={13} aria-hidden />{t("appearance.light")}
                    </button>
                    <button type="button" aria-pressed={dark === true} onClick={() => chooseTheme(true)}>
                      <Moon size={13} aria-hidden />{t("appearance.dark")}
                    </button>
                  </fieldset>
                </div>
                <div className="set-row">
                  <span className="set-info">
                    <b>{t("appearance.reduceMotion")}</b>
                    <span>{t("appearance.reduceMotionHint")}</span>
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={motion}
                    aria-label={t("appearance.reduceMotion")}
                    className="switch"
                    onClick={chooseMotion}
                  />
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
                  <fieldset className="seg" aria-label={t("language.title")}>
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
                  </fieldset>
                </div>
              </div>
            </section>
          )}

          {cat === "location" && <LocationPanel />}

          {cat === "notifications" && <NotificationsPanel />}
        </div>
      </div>
    </div>
  );
}
