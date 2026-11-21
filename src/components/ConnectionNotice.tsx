"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Wifi, WifiOff, X } from "lucide-react";

/**
 * Connection watcher. While the app is open:
 *
 *  • online → offline: a persistent notice appears in the right corner
 *    ("Your internet connection was lost") and stays until the
 *    connection returns or the visitor dismisses it.
 *
 *  • offline → online: the notice flips to a short "Connection restored"
 *    note that dismisses itself after a few seconds.
 *
 * The "opened WITHOUT internet" case is handled separately by the
 * service worker, which serves the cached offline page instead.
 */
export function ConnectionNotice() {
  const t = useTranslations("connection");
  const [lost, setLost] = useState(false);
  const [back, setBack] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const goOnline = () => {
      setLost(false);
      setDismissed(false);
      setBack(true);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setBack(false), 4000);
    };
    const goOffline = () => {
      setLost(true);
      setBack(false);
    };

    // Already offline when the app loads — show the notice right away.
    if (!navigator.onLine) goOffline();

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  if (lost && !dismissed) {
    return (
      <div className="conn-toast" role="alert" data-kind="lost">
        <WifiOff size={17} aria-hidden />
        <p>{t("lost")}</p>
        <button type="button" aria-label={t("dismiss")} onClick={() => setDismissed(true)}>
          <X size={14} aria-hidden />
        </button>
      </div>
    );
  }

  if (back) {
    return (
      <output className="conn-toast" data-kind="back">
        <Wifi size={17} aria-hidden />
        <p>{t("back")}</p>
      </output>
    );
  }

  return null;
}
