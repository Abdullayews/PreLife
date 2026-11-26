/**
 * Web notification permission — the Notifications API, the device-level
 * gate Settings → Notifications asks for.
 *
 * Two separate layers, deliberately kept apart:
 *   1. The browser PERMISSION (this module) — per-browser, per-site,
 *      asked once via Notification.requestPermission() from a user
 *      gesture; "denied" can only be lifted from the browser's own site
 *      settings, never re-prompted.
 *   2. The channel OPT-INS (profiles.notify_* — v3.8) — the account-level
 *      choices ("reminders / digest / news"), synced through
 *      /api/me/preferences.
 */

export type NotifPermission = "granted" | "denied" | "default" | "unsupported";

/** The current permission — "unsupported" when the API is absent
 *  (e.g. iOS Safari before 16.4, some embedded webviews). */
export function notifPermission(): NotifPermission {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

/** requestPermission wrapped in a promise — the callback-only shape
 *  (old Safari) and a synchronous throw (permission policy blocks) both
 *  fold into the CURRENT permission instead of hanging forever. */
export function requestNotifPermission(): Promise<NotifPermission> {
  return new Promise((resolve) => {
    const settle = () => resolve(notifPermission());
    try {
      const result = Notification.requestPermission((legacy) =>
        resolve(legacy === "granted" || legacy === "denied" ? legacy : "default"),
      );
      if (result && typeof result.then === "function") result.then(settle, settle);
    } catch {
      settle();
    }
  });
}

/** Show a local notification through the granted permission. Returns
 *  "shown" (constructor path), "sw" (queued through the service worker —
 *  Android Chrome forbids the constructor) or "failed". */
export type NotifShowResult = "shown" | "sw" | "failed";

export function showNotif(title: string, body: string): NotifShowResult {
  if (typeof window === "undefined" || !("Notification" in window)) return "failed";
  if (Notification.permission !== "granted") return "failed";
  const options: NotificationOptions = { body, tag: "prelife" };
  try {
    new Notification(title, options);
    return "shown";
  } catch {
    /* Android Chrome: the constructor is illegal without a service
       worker — fall through to the SW registration path. */
  }
  try {
    void navigator.serviceWorker
      ?.ready.then((reg) => {
        void reg.showNotification(title, options);
      })
      .catch(() => {});
    return "sw";
  } catch {
    return "failed";
  }
}
