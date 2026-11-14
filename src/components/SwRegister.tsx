"use client";

import { useEffect } from "react";

/**
 * Registers the offline service worker (public/sw.js) — a progressive
 * enhancement, registered shortly after paint so it never competes with
 * app boot. The worker only steps in when a page navigation FAILS (no
 * network): it then serves the cached standalone offline page. While
 * online everything passes straight through, so HMR and dev behaviour
 * are unaffected.
 */
export function SwRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const id = window.setTimeout(() => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* SW is optional — registration failures are silently ignored */
      });
    }, 1200);
    return () => window.clearTimeout(id);
  }, []);

  return null;
}
