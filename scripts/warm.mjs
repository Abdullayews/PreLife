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
 * What this script does, once the dev server answers on :3000:
 *      (prelife-api on :3031), which also lazily creates the account;
 *   2. requests every page route once (with the session cookie, so the
 *      signed-in surfaces — not the login redirect — get compiled);
 *   3. requests every Rust API route once: GETs normally, POSTs with an
 *      INVALID empty body (the handlers validate before any side effect,
 *      so this warms the code path without touching data);
 *   4. POST /api/auth/logout last — revokes the warmup session.
 *
 * It is hooked into `bun run dev` (see package.json): the dev server
 * starts in the background, this script runs in the foreground, and
 * `wait` keeps the script alive for the manager. Warming must never take
 * the dev server down: every failure is logged and skipped, and the
 * script always exits 0.
 */
const BASE = process.env.WARM_BASE ?? "http://127.0.0.1:3000";
const API = process.env.WARM_API ?? "http://127.0.0.1:3031";
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

  //    account-bearing deployment.
  let cookie = "";
  try {
    const res = await fetch(`${API}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
    });
    await res.arrayBuffer();
    // Node ≥ 20: raw Set-Cookie lines, e.g. "pl_session=abc; Path=/; …"
    const jar = (res.headers.getSetCookie?.() ?? [])
      .map((line) => line.split(";")[0])
      .filter(Boolean);
    if (res.ok && jar.length) {
      cookie = jar.join("; ");
    } else {
      out(`login not available (status ${res.status}) — warming public surface only`);
    }
  } catch (err) {
    out(`login failed (${err?.message ?? err}) — warming public surface only`);
  }
  const withSession = (init = {}) =>
    cookie ? { ...init, headers: { ...init.headers, cookie } } : init;

  // 2. Pages — compiled once each; the [locale] module is shared, so the
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
      const res = await fetchOk(`${BASE}${path}`, withSession({ cache: "no-store" }));
      out(`${path} ${res.status} ${Math.round(performance.now() - t0)}ms`);
    } catch (err) {
      out(`${path} FAILED ${err?.message ?? err}`);
    }
  }

  // 3. Rust API routes — GETs are side-effect free; POSTs send an invalid
  //    empty body so every handler's validation path (a 400) runs, never
  //    its writes.
  const gets = [
    "/api/auth/me", "/api/devices", "/api/psych/journal", "/api/psych/mood",
    "/api/psych/book", "/api/psych/bookings", "/api/psych/schedule-window",
    "/api/psych/overview", "/api/content/worlds", "/api/content/gym",
    "/api/content/diet", "/api/content/meditation", "/api/content/library",
    "/api/content/subscription", "/api/i18n?locale=en",
  ];
  const badPosts = [
    "/api/auth/signup", "/api/psych/quiz", "/api/psych/book", "/api/psych/pay",
    "/api/psych/cancel", "/api/psych/progress", "/api/psych/journal",
    "/api/psych/mood",
  ];
  for (const path of gets) {
    if (expired()) { out("deadline hit — stopping early"); return finish(); }
    try {
      const res = await fetchOk(`${API}${path}`, withSession({ cache: "no-store" }));
      out(`GET ${path} ${res.status}`);
    } catch (err) {
      out(`GET ${path} FAILED ${err?.message ?? err}`);
    }
  }
  for (const path of badPosts) {
    if (expired()) { out("deadline hit — stopping early"); return finish(); }
    try {
      const res = await fetchOk(`${API}${path}`, withSession({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      }));
      out(`POST ${path} ${res.status} (validation warm — 400 expected)`);
    } catch (err) {
      out(`POST ${path} FAILED ${err?.message ?? err}`);
    }
  }
  return finish();

  async function finish() {
    // 4. Revoke the warmup session — leave no stale rows behind.
    if (cookie) {
      try {
        await fetchOk(`${API}/api/auth/logout`, { method: "POST", headers: { cookie } });
        out("warmup session revoked");
      } catch { /* best effort */ }
    }
    out("done");
  }
}

main().catch((err) => {
  out(`unexpected error: ${err?.message ?? err}`);
  process.exit(0); // warming must never break `dev`
});
