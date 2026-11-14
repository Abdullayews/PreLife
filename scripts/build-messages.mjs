import { writeFile } from "node:fs/promises";
import { en } from "./messages-en.mjs";
import { az } from "./messages-az.mjs";
import { ru } from "./messages-ru.mjs";

/** Pure-ASCII JSON on disk: escape every non-ASCII char as \uXXXX.
 *  NOTE: only chars > \x7F — control chars like \n are structural
 *  whitespace in JSON.stringify output and must stay literal. */
function toAsciiJson(value) {
  const json = JSON.stringify(value, null, 2);
  return (
    json.replace(/[\x80-\uFFFF]/g, (ch) => {
      return "\\u" + ch.charCodeAt(0).toString(16).padStart(4, "0");
    }) + "\n"
  );
}

/** Flatten nested message trees into dot-paths. */
function flatten(obj, prefix = "") {
  const out = new Map();
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object") {
      for (const [p, v] of flatten(value, path)) out.set(p, v);
    } else {
      out.set(path, String(value));
    }
  }
  return out;
}

/** Mini check:i18n — key-set parity + ICU {param} parity across locales. */
function verifyParity(locales) {
  const flat = Object.fromEntries(
    Object.entries(locales).map(([name, data]) => [name, flatten(data)])
  );
  const reference = [...flat.en.keys()].sort();
  let ok = true;
  for (const [name, map] of Object.entries(flat)) {
    const keys = [...map.keys()].sort();
    const missing = reference.filter((k) => !map.has(k));
    const extra = keys.filter((k) => !flat.en.has(k));
    if (missing.length || extra.length) {
      ok = false;
      console.error(
        `[${name}] key mismatch — missing: ${JSON.stringify(missing)}, extra: ${JSON.stringify(extra)}`
      );
    }
    for (const [path, value] of map) {
      const params = (value.match(/\{(\w+)\}/g) ?? [])
        .sort()
        .join(",");
      const refValue = flat.en.get(path) ?? "";
      const refParams = (refValue.match(/\{(\w+)\}/g) ?? []).sort().join(",");
      if (params !== refParams) {
        ok = false;
        console.error(
          `[${name}] ICU param mismatch at "${path}": en={${refParams}} ${name}={${params}}`
        );
      }
    }
  }
  if (!ok) process.exit(1);
  console.log(
    `parity OK — ${reference.length} keys, identical ICU params across en/az/ru`
  );
}

const locales = { en, az, ru };
verifyParity(locales);

for (const [locale, data] of Object.entries(locales)) {
  const out = toAsciiJson(data);
  if (/[^\x00-\x7F]/.test(out)) {
    console.error(`[${locale}] non-ASCII leaked into output`);
    process.exit(1);
  }
  await writeFile(
    new URL(`../messages/${locale}.json`, import.meta.url),
    out,
    "utf8"
  );
  console.log(`wrote messages/${locale}.json`);
}
