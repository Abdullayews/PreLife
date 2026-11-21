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
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const API = path.join(ROOT, "mini-services/prelife-api");
const OUT = path.join(API, "target/release/prelife-api");

const log = (m) => console.log(`[build-backend] ${m}`);

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
  stdio: "inherit",
});
if (built.status !== 0) {
  log("cargo build --release FAILED");
  process.exit(1);
}
if (!existsSync(OUT)) {
  log(`build reported success but ${OUT} is missing`);
  process.exit(1);
}
log(`backend built: ${path.relative(ROOT, OUT)}`);
