#!/usr/bin/env node
/**
 * start-production.mjs — the single-service production boot (Render).
 *
 * v5.3 layout: the Rust backend (prelife-api) and the Next.js standalone
 * server run in ONE web service. This supervisor:
 *
 *   1. spawns prelife-api on 127.0.0.1:3030 (binary built by
 *      scripts/build-backend.mjs during the deploy);
 *   2. waits for /api/health (up to 30 s, then continues with a loud
 *      warning — Render restarts us if the backend is crash-looping);
 *   3. spawns the Next standalone server (HOSTNAME=0.0.0.0, Render's
 *      PORT respected, `.env.production` loaded exactly like the old
 *      start script did).
 *
 * The browser talks same-origin /api/* — next.config.ts proxies those to
 * 127.0.0.1:3030 — and the SSR layer keeps calling API_INTERNAL_URL
 * directly (server-to-server, no proxy hop).
 *
 * If EITHER process dies the other is stopped and the supervisor exits
 * non-zero, so Render restarts the whole service instead of serving a
 * half-broken stack.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const BIN = path.join(ROOT, "mini-services/prelife-api/target/release/prelife-api");
const NEXT = path.join(ROOT, ".next/standalone/server.js");
const PORT = 3030;

const log = (m) => console.log(`[start-production] ${m}`);

for (const [what, p] of [["backend binary", BIN], ["Next standalone server", NEXT]]) {
  if (!existsSync(p)) {
    log(`${what} missing: ${p}`);
    log(what === "backend binary"
      ? "the deploy build (scripts/build-backend.mjs) must run before start"
      : "run `next build` (standalone output) before start");
    process.exit(1);
  }
}

/* PUBLIC_URL pins the backend's origin allowlist (verification links,
 * OAuth redirects, cookie Secure decisions — session.rs origin_from).
 * Dashboard env always wins; the fallback only fills the gap when it is
 * unset: Render's own external URL plus the canonical custom domain. */
const backendEnv = { ...process.env };
if (!backendEnv.PUBLIC_URL) {
  const fallback = [backendEnv.RENDER_EXTERNAL_URL, "https://prelife.net"]
    .filter(Boolean)
    .join(",");
  if (fallback) {
    backendEnv.PUBLIC_URL = fallback;
    log(`PUBLIC_URL unset — defaulting allowlist to ${fallback}`);
  }
}
backendEnv.NODE_ENV = "production";
backendEnv.PRELIFE_ROOT = ROOT;
backendEnv.PRELIFE_API_PORT = String(PORT);

const children = [];
let shuttingDown = false;

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const c of children) {
    try { c.kill("SIGTERM"); } catch {}
  }
  /* Give both children a graceful exit window, then force-kill. The
   * backend flushes the emu store on SIGTERM (not used in production,
   * but harmless) and Next finishes in-flight responses. */
  const killer = setTimeout(() => {
    for (const c of children) {
      try { c.kill("SIGKILL"); } catch {}
    }
    process.exit(code);
  }, 5000);
  killer.unref();
  process.exitCode = code;
}

const backend = spawn(BIN, [], {
  cwd: ROOT,
  env: backendEnv,
  stdio: "inherit",
});
children.push(backend);
log(`backend spawned (pid ${backend.pid}) on 127.0.0.1:${PORT}`);

async function waitForHealth(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/api/health`, {
        signal: AbortSignal.timeout(1000),
      });
      if (res.ok) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

const healthy = await waitForHealth(30_000);
log(healthy
  ? "backend healthy (/api/health 200)"
  : "backend did NOT answer /api/health within 30s — starting Next anyway; check the logs above");

const web = spawn(
  "node",
  ["--env-file-if-exists=.env.production", NEXT],
  {
    cwd: ROOT,
    env: { ...process.env, NODE_ENV: "production", HOSTNAME: "0.0.0.0" },
    stdio: "inherit",
  },
);
children.push(web);
log(`Next standalone server spawned (pid ${web.pid}, PORT=${process.env.PORT ?? "unset → 3000"})`);

backend.on("exit", (code) => {
  if (!shuttingDown) {
    log(`backend exited (code ${code}) — stopping the service`);
    shutdown(code ?? 1);
  }
});
web.on("exit", (code) => {
  if (!shuttingDown) {
    log(`Next server exited (code ${code}) — stopping the service`);
    shutdown(code ?? 1);
  }
});

for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, () => {
    log(`received ${sig} — shutting down`);
    shutdown(0);
  });
}

/* Keep the supervisor alive; the children own the event loop refs. */
setInterval(() => {}, 1 << 30);
