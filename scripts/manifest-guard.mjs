#!/usr/bin/env node
/**
 * manifest-guard.mjs — a DEV-ONLY watchdog for the Next 16 dev-mode
 * prerender-manifest write race.
 *
 * The bug (observed on next 16.4.6): when several routes finish
 * background dev-prerendering at once (fresh .next, the warm script),
 * two concurrent writers update .next/dev/prerender-manifest.json and the
 * file ends up as one COMPLETE JSON document plus the trailing bytes of a
 * second write. Every subsequent request then dies with
 * "SyntaxError: Unexpected non-whitespace character after JSON" until the
 * server is restarted.
 *
 * The guard polls the file every 3 seconds and, on corruption, rewrites
 * it as the first complete JSON document (JSON.raw_decode semantics) —
 * the manifest is a cache of dev-prerender state, so a slightly stale
 * value is harmless; Next rewrites it as routes complete.
 */
import { readFileSync, renameSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST = path.resolve(HERE, "../.next/dev/prerender-manifest.json");

const log = (m) => console.log(`[manifest-guard] ${m}`);

let repairs = 0;

function checkOnce() {
  if (!existsSync(MANIFEST)) return;
  let raw;
  try {
    raw = readFileSync(MANIFEST, "utf8");
  } catch {
    return; // mid-write — next tick will see the final bytes
  }
  try {
    JSON.parse(raw);
  } catch {
    // Corrupt — keep the first complete JSON document.
    // A hand-rolled raw_decode: find the end of the first top-level value.
    let depth = 0;
    let inStr = false;
    let end = -1;
    for (let i = 0; i < raw.length; i++) {
      const c = raw[i];
      if (inStr) {
        if (c === "\\") i++;
        else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') inStr = true;
      else if (c === "{" || c === "[") depth++;
      else if (c === "}" || c === "]") {
        depth--;
        if (depth === 0) {
          end = i + 1;
          break;
        }
      }
    }
    if (end > 0) {
      try {
        const repaired = raw.slice(0, end);
        JSON.parse(repaired); // sanity: must be valid now
        // Atomic: Next must never observe a half-written manifest (the
        // exact race this guard exists for, one level down).
        const tmp = `${MANIFEST}.repair.${process.pid}`;
        writeFileSync(tmp, repaired);
        renameSync(tmp, MANIFEST);
        repairs++;
        log(`repaired the prerender manifest (${raw.length} → ${repaired.length} bytes, repair #${repairs})`);
        return;
      } catch {
        /* fall through */
      }
    }
    log("manifest unreadable beyond repair — leaving it for Next to rewrite");
  }
}

log(`watching ${MANIFEST}`);
setInterval(checkOnce, 3000);
