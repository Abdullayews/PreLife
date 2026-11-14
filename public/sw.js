/* PreLife offline service worker.
 *
 * Purpose: when the site is opened WITHOUT internet, page navigations
 * fail — this worker catches the failure and serves a cached,
 * self-contained offline page instead (public/offline/<locale>.html).
 *
 * Scope is deliberately minimal: ONLY navigation requests are handled,
 * network-first. Assets, API calls and dev/HMR traffic pass straight
 * through, and successful responses are never cached — so the worker
 * can never serve stale content while online.
 */
const CACHE = "prelife-offline-v1";
const OFFLINE_PAGES = ["/offline/az.html", "/offline/en.html", "/offline/ru.html"];
const DEFAULT_OFFLINE = "/offline/en.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(OFFLINE_PAGES))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.mode !== "navigate") return;

  event.respondWith(
    fetch(req).catch(() => {
      // Network failed → offline. Pick the offline page matching the
      // locale of the URL the visitor asked for.
      let page = DEFAULT_OFFLINE;
      try {
        const seg = new URL(req.url).pathname.split("/")[1];
        if (OFFLINE_PAGES.includes(`/offline/${seg}.html`)) page = `/offline/${seg}.html`;
      } catch {
        /* malformed URL — fall back to the default page */
      }
      return caches.match(page).then(
        (cached) =>
          cached ??
          new Response("Offline", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          }),
      );
    }),
  );
});
