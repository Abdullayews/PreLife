// Verifies that every messages/<locale>.json has the same set of keys and
// that shared keys use the same ICU {param} placeholders.
// Usage: node scripts/check-messages.mjs   (or: npm run check:i18n)
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const messagesDir = join(__dirname, "..", "messages");
const REFERENCE = "en"; // keep in sync with i18n/routing.ts defaultLocale

/** Flattens nested message objects to "a.b.c" -> value. */
function flatten(value, prefix = "", out = new Map()) {
  for (const [key, entry] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (entry && typeof entry === "object") {
      flatten(entry, path, out);
    } else {
      out.set(path, String(entry));
    }
  }
  return out;
}

function paramsOf(text) {
  return [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort().join(",");
}

const byLocale = {};
for (const file of readdirSync(messagesDir).sort()) {
  if (!file.endsWith(".json")) continue;
  const locale = file.replace(/\.json$/, "");
  try {
    byLocale[locale] = flatten(JSON.parse(readFileSync(join(messagesDir, file), "utf8")));
  } catch (error) {
    console.error(`[FAIL] ${file}: invalid JSON - ${error.message}`);
    process.exit(1);
  }
}

const locales = Object.keys(byLocale);
if (locales.length < 2) {
  console.error("[FAIL] expected at least 2 message files");
  process.exit(1);
}
if (!byLocale[REFERENCE]) {
  console.error(`[FAIL] reference locale "${REFERENCE}" not found`);
  process.exit(1);
}

let failed = false;
for (const locale of locales) {
  if (locale === REFERENCE) continue;
  const reference = byLocale[REFERENCE];
  const candidate = byLocale[locale];

  for (const key of reference.keys()) {
    if (!candidate.has(key)) {
      console.error(`[FAIL] [${locale}] missing key: ${key}`);
      failed = true;
    }
  }
  for (const key of candidate.keys()) {
    if (!reference.has(key)) {
      console.error(`[FAIL] [${locale}] extra key: ${key}`);
      failed = true;
    }
  }
  for (const [key, value] of reference) {
    if (!candidate.has(key)) continue;
    if (paramsOf(value) !== paramsOf(candidate.get(key))) {
      console.error(
        `[FAIL] [${locale}] key "${key}" ICU params differ (expected {${paramsOf(value)}}, got {${paramsOf(candidate.get(key))}})`
      );
      failed = true;
    }
  }
}

if (failed) {
  console.error(`[FAIL] message parity check failed (${locales.join(", ")})`);
  process.exit(1);
}
console.log(
  `[OK] message parity: ${locales.length} locales x ${byLocale[REFERENCE].size} keys, ICU params consistent`
);
