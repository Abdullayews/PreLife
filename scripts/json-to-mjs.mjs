/**
 * Regenerate scripts/messages-{en,az,ru}.mjs FROM the live messages/*.json.
 *
 * Why this direction: the .mjs files started as hand-written sources, but
 * later feature work edited the JSON directly — the .mjs snapshot silently
 * went stale, and one careless `build-messages.mjs` run overwrote three
 * namespaces out of the JSON (caught and restored from git). After this
 * regeneration the .mjs files mirror reality again and stay the canonical
 * edit surface: change a string here, run build-messages.mjs, get the
 * ASCII-escaped JSON back (plus the az/en/ru parity check).
 *
 * Usage: bun scripts/json-to-mjs.mjs
 */
import { readFile, writeFile } from "node:fs/promises";

const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/** JS object literal source, 2-space indent, keys unquoted when safe. */
function toLiteral(value, indent = "  ") {
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    const items = value.map((v) => toLiteral(v, indent + "  "));
    return items.length
      ? `[\n${items.map((s) => `${indent}  ${s}`).join(",\n")}\n${indent}]`
      : "[]";
  }
  const entries = Object.entries(value);
  if (!entries.length) return "{}";
  const lines = entries.map(([k, v]) => {
    const key = IDENT.test(k) ? k : JSON.stringify(k);
    return `${indent}  ${key}: ${toLiteral(v, indent + "  ")}`;
  });
  return `{\n${lines.join(",\n")}\n${indent}}`;
}

for (const locale of ["en", "az", "ru"]) {
  const json = JSON.parse(
    await readFile(new URL(`../messages/${locale}.json`, import.meta.url), "utf8"),
  );
  const name = { en: "en", az: "az", ru: "ru" }[locale];
  const out = `// GENERATED from messages/${locale}.json by scripts/json-to-mjs.mjs —\n// edit strings here, then run: bun scripts/build-messages.mjs\nexport const ${name} = ${toLiteral(json)};\n`;
  await writeFile(new URL(`./messages-${locale}.mjs`, import.meta.url), out);
  console.log(`wrote scripts/messages-${locale}.mjs (${Object.keys(json).length} namespaces)`);
}
