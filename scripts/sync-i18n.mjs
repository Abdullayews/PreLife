#!/usr/bin/env node
/**
 * Sync the canonical i18n catalog (messages/{az,en,ru}.json — built from
 * scripts/messages-*.mjs) into the real Supabase `i18n_messages` table.
 *
 * The DB layer wins per-key over the bundled static files, so the table
 * must contain EVERY key — otherwise stale DB rows override fresh static
 * strings. This script UPSERTS every flattened dotted key with its
 * az/en/ru values (merge-duplicates on the primary key) — a failed chunk
 * can never leave the table partially EMPTIED, the way delete-then-insert
 * could.
 *
 * Usage:
 *   SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=<key> \
 *   node scripts/sync-i18n.mjs
 */
import { readFile } from "node:fs/promises";

const SUPA_URL = process.env.SUPABASE_URL ?? "";
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
if (!SUPA_URL || !KEY) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  process.exit(1);
}
const REST = `${SUPA_URL.replace(/\/+$/, "")}/rest/v1`;
const HDRS = {
  apikey: KEY,
  authorization: `Bearer ${KEY}`,
  "content-type": "application/json",
  prefer: "return=minimal",
};

/** Flatten nested message objects into dotted keys. */
function flatten(obj, prefix = "") {
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object") out.push(...flatten(v, key));
    else out.push([key, String(v)]);
  }
  return out;
}

const locales = ["az", "en", "ru"];
const catalogs = {};
for (const loc of locales) {
  catalogs[loc] = JSON.parse(await readFile(new URL(`../messages/${loc}.json`, import.meta.url), "utf8"));
}

/* Merge every locale's keys (they are parity-checked by build-messages). */
const map = new Map();
for (const loc of locales) {
  for (const [key, value] of flatten(catalogs[loc])) {
    if (!map.has(key)) map.set(key, { key });
    map.get(key)[`value_${loc}`] = value;
  }
}
const rows = [...map.values()];
console.log(`catalog: ${rows.length} keys`);

/* Upsert in chunks of 300 — merge-duplicates overwrites existing keys and
 * inserts new ones; nothing is deleted first, so a network hiccup mid-run
 * degrades to "some rows stale", never "catalog half gone". */
const CHUNK = 300;
let done = 0;
let res;
for (let i = 0; i < rows.length; i += CHUNK) {
  const chunk = rows.slice(i, i + CHUNK);
  res = await fetch(`${REST}/i18n_messages?on_conflict=key`, {
    method: "POST",
    headers: { ...HDRS, prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(chunk),
  });
  if (!res.ok) {
    console.error(`upsert failed ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
  done += chunk.length;
  process.stdout.write(`\rupserted ${done}/${rows.length}`);
}
console.log(`\nOK — i18n_messages covers the whole catalog (stale extras, if any, remain harmless).`);
