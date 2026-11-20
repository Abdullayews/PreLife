#!/usr/bin/env node
/**
 * Dev-server warmup — sandbox↔Render performance parity.
 *
 * Why: `next dev` compiles every route lazily, on its first request. In
 * the sandbox preview the first visit to each page therefore pays a
 * 0.2–4s Turbopack compile, while the production build on Render serves
 * every route pre-compiled (tens of ms). That gap is exactly why the
 * sandbox felt slower and "not the same" as the live site.
 *
 * What this script does, once the dev server answers on :3000 (the
 * merged backend serves /api/* from the same origin now):
 *   1. requests every page route once (public pages fully; protected
 *      ones compile their login-redirect path — enough to kill the lag);
 *   2. requests every API route once: GETs normally, POSTs with an
 *      INVALID empty body (the handlers validate before any side
 *      effect, so this warms the code path without touching data).
 *
 * It is hooked into `bun run dev` (see package.json): the dev server
 * starts in the background, this script runs in the foreground, and
 * `wait` keeps the script alive for the manager. Warming must never take
 * the dev server down: every failure is logged and skipped, and the
 * script always exits 0.
 */
const BASE = process.env.WARM_BASE ?? "http://127.0.0.1:3000";
const DEADLINE_MS = 150_000; // give up quietly after 2.5 minutes
const startedAt = Date.now();

const out = (msg) => console.log(`[warm] ${msg}`);
const expired = () => Date.now() - startedAt > DEADLINE_MS;

async function fetchOk(url, init) {
  const res = await fetch(url, { ...init, redirect: "follow" });
  await res.arrayBuffer(); // drain the body so the render fully completes
  return res;
}

/** Poll the root until the dev server answers (any status = ready). */
async function waitForServer() {
  for (let i = 0; i < 180; i++) {
    try {
      await fetchOk(`${BASE}/`, { cache: "no-store" });
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  return false;
}

async function main() {
  if (!(await waitForServer())) {
    out("dev server never answered on :3000 — skipping warmup");
    return;
  }
  out("server ready — warming routes (kills the first-visit compile lag)");

  // 1. Pages — compiled once each; the [locale] module is shared, so the
  //    en pass warms az/ru too. The az/ru spots below just pre-render their
  //    first paint. The last entry compiles the 404 surfaces.
  const pages = [
    "/en/welcome", "/en/welcome/gym", "/en/welcome/diet",
    "/en/welcome/meditation", "/en/welcome/library",
    "/en/login", "/en/signup", "/en/terms", "/en/rules", "/en/help",
    "/en/home", "/en/gym", "/en/diet", "/en/meditation", "/en/library",
    "/en/subscription", "/en/profile", "/en/settings",
    "/en/meditation/practice", "/en/meditation/mood", "/en/meditation/journal",
    "/en/meditation/bookings", "/en/meditation/psychologists", "/en/meditation/tdb",
    "/en/diet/plans", "/en/diet/recipes", "/en/diet/places",
    "/az/home", "/az/diet", "/ru/home", "/ru/diet",
    "/en/__warmup_404__",
  ];
  for (const path of pages) {
    if (expired()) { out("deadline hit — stopping early"); return finish(); }
    try {
      const t0 = performance.now();
      const res = await fetchOk(`${BASE}${path}`, { cache: "no-store" });
      out(`${path} ${res.status} ${Math.round(performance.now() - t0)}ms`);
    } catch (err) {
      out(`${path} FAILED ${err?.message ?? err}`);
    }
  }

  // 2. API routes (same origin now) — GETs are side-effect free; POSTs
  //    send an invalid empty body so every handler's validation path
  //    (a 400/401) runs, never its writes.
  const gets = [
    "/api/health", "/api/auth/me", "/api/devices", "/api/psych/journal",
    "/api/psych/mood", "/api/psych/book", "/api/psych/bookings",
    "/api/psych/schedule-window", "/api/psych/overview",
    "/api/content/worlds", "/api/content/gym", "/api/content/diet",
    "/api/content/meditation", "/api/content/library",
    "/api/content/subscription", "/api/i18n?locale=en",
    "/api/gym/plan",
  ];
  const badPosts = [
    "/api/auth/login", "/api/auth/signup", "/api/auth/resend", "/api/auth/complete",
    "/api/psych/quiz", "/api/psych/book", "/api/psych/pay",
    "/api/psych/cancel", "/api/psych/progress", "/api/psych/journal",
    "/api/psych/mood", "/api/ai/chat", "/api/psych/ai", "/api/gym/plan",
  ];
  for (const path of gets) {
    if (expired()) { out("deadline hit — stopping early"); return finish(); }
    try {
      const res = await fetchOk(`${BASE}${path}`, { cache: "no-store" });
      out(`GET ${path} ${res.status}`);
    } catch (err) {
      out(`GET ${path} FAILED ${err?.message ?? err}`);
    }
  }
  for (const path of badPosts) {
    if (expired()) { out("deadline hit — stopping early"); return finish(); }
    try {
      const res = await fetchOk(`${BASE}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      out(`POST ${path} ${res.status} (validation warm — 400/401 expected)`);
    } catch (err) {
      out(`POST ${path} FAILED ${err?.message ?? err}`);
    }
  }
  return finish();

  async function finish() {
    out("done");
  }
}

main().catch((err) => {
  out(`unexpected error: ${err?.message ?? err}`);
  process.exit(0); // warming must never break `dev`
});
