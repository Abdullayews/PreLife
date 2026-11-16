#!/usr/bin/env node
/**
 * ensure-sqlite-binding.mjs — self-healing guard for the better-sqlite3
 * native binding.
 *
 * WHY THIS EXISTS
 * Prisma's better-sqlite3 driver adapter loads a compiled .node addon.
 * That addon is built by better-sqlite3's own install script
 * (`prebuild-install || node-gyp rebuild`). Bun only runs dependency
 * install scripts for packages listed in `trustedDependencies` — if the
 * package ever gets reinstalled without that trust (or with
 * `--ignore-scripts`), the binding silently vanishes and every
 * DB-backed route 500s (login, signup, sessions, devices).
 *
 * This script is wired into `postinstall` and `predev`, so the binding
 * is verified on every install and every dev-server boot:
 *   - binding present → instant no-op (< 5 ms)
 *   - binding missing → rebuild via `npm rebuild better-sqlite3`
 *
 * Exit code is always 0 unless the rebuild itself fails; in that case
 * the failure is loud so it can't be mistaken for a working setup.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const pkgDir = path.resolve(import.meta.dirname, "..", "node_modules", "better-sqlite3");

/** Locations better-sqlite3's lib/database.js probes for the addon. */
const bindingPaths = [
  path.join(pkgDir, "build", "Release", "better_sqlite3.node"),
  path.join(pkgDir, "build", "Debug", "better_sqlite3.node"),
  path.join(pkgDir, "prebuilds"), // prebuild-install cache dir (any platform)
];

const tag = "[ensure-sqlite-binding]";

if (bindingPaths.some((p) => existsSync(p))) {
  process.exit(0); // all good — nothing to do
}

if (!existsSync(pkgDir)) {
  // Dependency not installed at all — plain `bun install` handles that;
  // nothing this script can fix.
  console.warn(`${tag} node_modules/better-sqlite3 missing — run bun install`);
  process.exit(0);
}

console.warn(`${tag} native binding missing — rebuilding better-sqlite3 …`);

// `npm rebuild` runs the package's install script (prebuild-install falls
// back to node-gyp). Prefer npm; fall back to bun's run if npm is absent.
const attempts = [
  ["npm", ["rebuild", "better-sqlite3"]],
  ["bun", ["run", "install"]],
];

let ok = false;
for (const [cmd, args] of attempts) {
  const res = spawnSync(cmd, args, {
    cwd: cmd === "bun" ? pkgDir : path.resolve(pkgDir, "..", ".."),
    stdio: "inherit",
  });
  if (res.status === 0 && bindingPaths.some((p) => existsSync(p))) {
    ok = true;
    break;
  }
}

if (!ok) {
  console.error(
    `${tag} rebuild failed — login and every DB-backed route WILL 500. ` +
      `Fix manually: cd node_modules/better-sqlite3 && npm run install`,
  );
  process.exit(1);
}

console.warn(`${tag} binding rebuilt successfully.`);
