#!/usr/bin/env bun
/**
 * The dev watcher for the Rust backend — `bun run dev` builds the crate
 * (if needed), runs the binary, and rebuilds + restarts whenever a
 * src/**.rs / Cargo.toml file changes. The binary inherits:
 *
 *   PRELIFE_ROOT  the repo root (…/my-project) so the service reads the
 *                 same .env, db/seed-content.sql, db/emu-store.json and
 *                 messages/*.json the Next.js frontend uses.
 *   PORT          fixed to 3030 (the gateway's XTransformPort target).
 */
import { spawn } from "node:child_process";
import { watch } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const PORT = "3030";

const log = (m) => console.log(`[prelife-api] ${m}`);

/** cargo build, resolving $PATH-independent cargo via ~/.cargo/bin. */
function build() {
  return new Promise((resolve) => {
    const cargo = process.env.CARGO ?? path.join(process.env.HOME ?? "/home/z", ".cargo/bin/cargo");
    const p = spawn(cargo, ["build"], { cwd: HERE, stdio: "inherit" });
    p.on("exit", (code) => resolve(code === 0));
  });
}

let child = null;
let restarting = false;

function stopChild() {
  return new Promise((resolve) => {
    if (!child || child.exitCode !== null) return resolve();
    child.on("exit", () => resolve());
    child.kill("SIGTERM");
    setTimeout(() => child && child.kill("SIGKILL"), 4000).unref();
  });
}

async function start() {
  const ok = await build();
  if (!ok) {
    log("cargo build FAILED — fix the errors; the previous binary (if any) keeps running");
    return;
  }
  await stopChild();
  child = spawn(path.join(HERE, "target/debug/prelife-api"), [], {
    cwd: HERE,
    env: { ...process.env, PRELIFE_ROOT: ROOT, PORT, PRELIFE_API_PORT: PORT },
    stdio: "inherit",
  });
  child.on("exit", (code, sig) => {
    if (!restarting && code !== 0) log(`binary exited (${code}${sig ? ` ${sig}` : ""})`);
  });
  log(`running on :${PORT} (PRELIFE_ROOT=${ROOT})`);
}

async function restart() {
  if (restarting) return;
  restarting = true;
  log("source change — rebuilding…");
  await start();
  restarting = false;
}

await start();

let timer = null;
const debounce = () => {
  clearTimeout(timer);
  timer = setTimeout(restart, 120);
};
try {
  watch(path.join(HERE, "src"), { recursive: true }, (_, f) => {
    if (f && !/\.rs$/.test(f)) return;
    debounce();
  });
  watch(HERE, (_, f) => {
    if (f === "Cargo.toml") debounce();
  });
} catch { /* watch unsupported — manual restart still works */ }
log("watching src/**.rs for changes");
