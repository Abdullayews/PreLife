#!/usr/bin/env node
/**
 * dev-backend.mjs — start the RUST BACKEND (mini-services/prelife-api)
 * before `next dev`, idempotently:
 *
 *   1. /api/health already answers on :3030 → nothing to do (the watcher
 *      or a previous run owns it);
 *   2. otherwise: cargo build (if needed) and spawn the binary detached
 *      (setsid — survives this script and the dev manager), logging to
 *      /tmp/prelife-api.log.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const API = path.join(ROOT, "mini-services/prelife-api");
const BIN = path.join(API, "target/debug/prelife-api");
const PORT = 3030;

const log = (m) => console.log(`[dev-backend] ${m}`);

async function alive() {
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/health`, {
      signal: AbortSignal.timeout(1500),
    });
    return res.ok;
  } catch {
    return false;
  }
}

if (await alive()) {
  log(`prelife-api already running on :${PORT}`);
  process.exit(0);
}

const cargo = process.env.CARGO ?? path.join(process.env.HOME ?? "/home/z", ".cargo/bin/cargo");
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
  const child = spawn(BIN, [], {
    cwd: API,
    env: { ...process.env, PRELIFE_ROOT: ROOT, PRELIFE_API_PORT: String(PORT) },
    detached: true,
    stdio: ["ignore", "ignore", "ignore"],
  });
  child.unref();
  for (let i = 0; i < 40; i++) {
    if (await alive()) {
      log(`prelife-api up on :${PORT} (pid ${child.pid})`);
      process.exit(0);
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  log("prelife-api did not answer in time — continuing");
}
