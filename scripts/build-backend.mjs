#!/usr/bin/env node
/**
 * build-backend.mjs — build the RUST backend for production. Part of
 * `bun run build` (the Render web service's build command).
 *
 * Production layout (v5.3): ONE Render web service runs the Next.js
 * standalone server AND prelife-api side by side (see
 * scripts/start-production.mjs). The native Node build environment has
 * gcc/make/curl but no Rust toolchain, so this script bootstraps rustup
 * (minimal profile) when cargo is missing, then runs
 * `cargo build --release --locked`.
 *
 * A missing backend is EXACTLY the outage this script exists to prevent
 * (the frontend alone answers every /api/* with a 404 HTML page) — so a
 * failed backend build fails the whole deploy, loudly.
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const API = path.join(ROOT, "mini-services/prelife-api");
const OUT = path.join(API, "target/release/prelife-api");

const log = (m) => console.log(`[build-backend] ${m}`);

/* Render's native build cache keeps $HOME/.cargo between builds (the
 * cargo binary and the crates.io registry already come from it — the
 * logs show no rustup bootstrap and no crate downloads). The repo
 * checkout, though, is fresh every build, so an in-repo target/ dir
 * recompiles every dependency on every deploy (~100 "Compiling"
 * lines, ~1m17s). Redirect the cargo target dir into the cached
 * cargo home on Render: only the changed crates recompile, then copy
 * the binary to the repo path start-production.mjs expects. Off
 * Render (local) nothing changes. */
const onRender =
  process.env.RENDER === "true" || existsSync("/opt/render/project/src");
const cargoHome = process.env.CARGO_HOME ?? path.join(os.homedir(), ".cargo");
const cacheTarget = path.join(cargoHome, "prelife-target");
const env = onRender
  ? { ...process.env, CARGO_TARGET_DIR: cacheTarget }
  : process.env;

let cargo = process.env.CARGO ?? path.join(os.homedir(), ".cargo/bin/cargo");
if (!existsSync(cargo)) {
  if (process.env.CARGO) {
    log(`CARGO=${process.env.CARGO} not found`);
    process.exit(1);
  }
  log("cargo not found — bootstrapping rustup (minimal profile, stable)…");
  const sh = spawnSync(
    "bash",
    [
      "-c",
      "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | " +
        "sh -s -- -y --profile minimal --default-toolchain stable",
    ],
    { stdio: "inherit" },
  );
  if (sh.status !== 0) {
    log("rustup bootstrap FAILED — cannot build the backend");
    process.exit(1);
  }
}

const built = spawnSync(cargo, ["build", "--release", "--locked"], {
  cwd: API,
  env,
  stdio: "inherit",
});
if (built.status !== 0) {
  log("cargo build --release FAILED");
  process.exit(1);
}
if (onRender) {
  const from = path.join(cacheTarget, "release", "prelife-api");
  if (!existsSync(from)) {
    log(`expected the binary at ${from} — missing after build`);
    process.exit(1);
  }
  mkdirSync(path.dirname(OUT), { recursive: true });
  copyFileSync(from, OUT);
  log(`binary copied from the cached target dir → ${path.relative(ROOT, OUT)}`);
}
if (!existsSync(OUT)) {
  log(`build reported success but ${OUT} is missing`);
  process.exit(1);
}
log(`backend built: ${path.relative(ROOT, OUT)}`);
