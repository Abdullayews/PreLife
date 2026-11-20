#!/usr/bin/env node
/**
 * dev-backend.mjs — start the RUST BACKEND (mini-services/prelife-api)
 * before `next dev`, idempotently:
 *
 *   1. /api/health already answers on :3030 → nothing to do (the watcher
 *      or a previous run owns it);
 *   2. port BUSY but unhealthy (a hung/stale occupant) → say so loudly and
 *      exit non-zero instead of spawning a doomed second binary whose bind
 *      would panic silently;
 *   3. otherwise: cargo build (if needed) and spawn the binary detached
 *      (setsid — survives this script and the dev manager), with its
 *      stdout/stderr streamed to /tmp/prelife-api.log.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, openSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const API = path.join(ROOT, "mini-services/prelife-api");
const BIN = path.join(API, "target/debug/prelife-api");
const PORT = 3030;
const LOG = "/tmp/prelife-api.log";

const log = (m) => console.log(`[dev-backend] ${m}`);

/** "healthy" = answers /api/health; "busy" = the port is taken but silent;
 *  "free" = connect refused. */
async function probe() {
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/health`, {
      signal: AbortSignal.timeout(1500),
    });
    return res.ok ? "healthy" : "busy";
  } catch (e) {
    // Timeout against a listening socket = busy-but-hung; refusal = free.
    return e?.name === "TimeoutError" || e?.code === "UND_ERR_CONNECT_TIMEOUT" ? "busy" : "free";
  }
}

const state = await probe();
if (state === "healthy") {
  log(`prelife-api already running on :${PORT}`);
  process.exit(0);
}
if (state === "busy") {
  log(`port ${PORT} is taken but /api/health does not answer — kill the stale occupant and re-run`);
  const found = spawnSync("bash", ["-c", `lsof -t -i:${PORT} 2>/dev/null || true`], { encoding: "utf8" });
  const pids = (found.stdout ?? "").trim();
  if (pids) log(`occupant pid(s): ${pids.split("\n").join(", ")}`);
  process.exit(1);
}

const cargo = process.env.CARGO ?? path.join(os.homedir(), ".cargo/bin/cargo");
if (existsSync(cargo)) {
  log("cargo build…");
  const built = spawnSync(cargo, ["build"], { cwd: API, stdio: "inherit" });
  if (built.status !== 0) {
    log("cargo build FAILED — the frontend starts anyway (API calls will 502)");
  }
} else if (!existsSync(BIN)) {
  log("cargo not found and no prebuilt binary — the frontend starts anyway");
}

if (existsSync(BIN)) {
  // The child's output lands in /tmp/prelife-api.log — a bind panic or an
  // env problem is readable there instead of vanishing.
  const out = openSync(LOG, "a");
  const child = spawn(BIN, [], {
    cwd: API,
    env: { ...process.env, PRELIFE_ROOT: ROOT, PRELIFE_API_PORT: String(PORT) },
    detached: true,
    stdio: ["ignore", out, out],
  });
  child.unref();
  for (let i = 0; i < 40; i++) {
    if ((await probe()) === "healthy") {
      log(`prelife-api up on :${PORT} (pid ${child.pid}, log ${LOG})`);
      process.exit(0);
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  log(`prelife-api did not answer in time — continuing (see ${LOG})`);
}
