#!/usr/bin/env node
/**
 * Dev-server warmup — sandbox↔Render performance parity.
 *
 * Why: `next dev` compiles every route lazily, on its first request. In the
 * sandbox preview the first visit to each page therefore pays a 0.2–4s
 * Turbopack compile, while the production build on Render serves every
 * route pre-compiled (tens of ms). That gap is exactly why the sandbox
 * felt slower and "not the same" as the live site.
 *
 * What this script does, once the dev server answers on :3000:
 *   1. signs in as the seeded demo account (123/123) — POST /api/auth/login,
 *      which also lazily creates the account on a fresh database;
 *   2. requests every page route once (with the session cookie, so the
 *      signed-in surfaces — not the login redirect — get compiled);
 *   3. requests every API route once: GETs normally, POSTs with an INVALID
 *      empty body (the handlers validate before any side effect, so this
 *      compiles the module without touching data);
 *   4. POST /api/auth/logout last — revokes the warmup session, leaving no
 *      stale rows behind.
 *
 * It is hooked into `npm run dev` (see package.json): the dev server starts
 * in the background, this script runs in the foreground, and `wait` keeps
 * the script alive for the manager. Warming must never take the dev server
 * down: every failure is logged and skipped, and the script always exits 0.
 */
const BASE = process.env.WARM_BASE ?? "http://127.0.0.1:3000";
const DEADLINE_MS = 150_000; // give up quietly after 2.5 minutes
const startedAt = Date.now();

const out = (msg) => console.log(`[warm] ${msg}`);
const expired = () => Date.now() - startedAt > DEADLINE_MS;

async function fetchOk(path, init) {
  const res = await fetch(`${BASE}${path}`, { ...init, redirect: "follow" });
  await res.arrayBuffer(); // drain the body so the render fully completes
  return res;
}

/** Poll the root until the dev server answers (any status = ready). */
async function waitForServer() {
  for (let i = 0; i < 180; i++) {
    try {
      await fetchOk("/", { cache: "no-store" });
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

  // 1. Demo sign-in. On a brand-new database this also seeds the 123/123
  //    account, so the sandbox behaves like an account-bearing deployment.
  let cookie = "";
  try {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "123", password: "123" }),
    });
    await res.arrayBuffer();
    // Node ≥ 20: raw Set-Cookie lines, e.g. "pl_session=abc; Path=/; …"
    const jar = (res.headers.getSetCookie?.() ?? [])
      .map((line) => line.split(";")[0])
      .filter(Boolean);
    if (res.ok && jar.length) {
      cookie = jar.join("; ");
      out(`signed in as the demo account (${jar.length} cookie[s])`);
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
    "/en/diet/practice", "/en/diet/mood", "/en/diet/journal",
    "/en/diet/bookings", "/en/diet/psychologists",
    "/az/home", "/az/diet", "/ru/home", "/ru/diet",
    "/en/__warmup_404__",
  ];
  for (const path of pages) {
    if (expired()) { out("deadline hit — stopping early"); return finish(); }
    try {
      const t0 = performance.now();
      const res = await fetchOk(path, withSession({ cache: "no-store" }));
      out(`${path} ${res.status} ${Math.round(performance.now() - t0)}ms`);
    } catch (err) {
      out(`${path} FAILED ${err?.message ?? err}`);
    }
  }

  // 3. APIs — GETs are side-effect free; POSTs send an invalid empty body
  //    so every handler's validation path (a 400) runs, never its writes.
  //    (/api/diet/progress is POST-only — it is warmed by the POST pass.)
  const gets = [
    "/api/auth/me", "/api/devices", "/api/diet/journal", "/api/diet/mood",
    "/api/diet/book",
  ];
  const badPosts = [
    "/api/auth/signup", "/api/diet/quiz", "/api/diet/book", "/api/diet/pay",
    "/api/diet/cancel", "/api/diet/progress", "/api/diet/ai",
    "/api/diet/journal",
  ];
  for (const path of gets) {
    if (expired()) { out("deadline hit — stopping early"); return finish(); }
    try {
      const t0 = performance.now();
      const res = await fetchOk(path, withSession({ cache: "no-store" }));
      out(`GET ${path} ${res.status} ${Math.round(performance.now() - t0)}ms`);
    } catch (err) { out(`GET ${path} FAILED ${err?.message ?? err}`); }
  }
  for (const path of badPosts) {
    if (expired()) { out("deadline hit — stopping early"); return finish(); }
    try {
      const t0 = performance.now();
      const res = await fetchOk(path, withSession({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      }));
      out(`POST ${path} ${res.status} ${Math.round(performance.now() - t0)}ms`);
    } catch (err) { out(`POST ${path} FAILED ${err?.message ?? err}`); }
  }

  // Dynamic [id] routes: bogus ids → 404, module compiled, nothing deleted.
  for (const [method, path] of [
    ["DELETE", "/api/diet/journal/__warmup_none__"],
    ["PATCH", "/api/devices/__warmup_none__"],
  ]) {
    if (expired()) break;
    try {
      const t0 = performance.now();
      const res = await fetchOk(path, withSession({
        method,
        headers: { "content-type": "application/json" },
        body: "{}",
      }));
      out(`${method} ${path} ${res.status} ${Math.round(performance.now() - t0)}ms`);
    } catch (err) { out(`${method} ${path} FAILED ${err?.message ?? err}`); }
  }

  // 4. Revoke the warmup session — no stale rows, no lingering cookie.
  if (cookie) {
    try { await fetchOk("/api/auth/logout", { method: "POST", ...withSession() }); }
    catch { /* the manager does not care */ }
  }
  finish();
}

function finish() {
  out(`done in ${Math.round((Date.now() - startedAt) / 1000)}s — first visits are now warm`);
}

main().catch((err) => {
  out(`unexpected error: ${err?.stack ?? err} — dev server is unaffected`);
});
