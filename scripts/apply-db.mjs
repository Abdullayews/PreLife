/**
 * apply-db.mjs — applies db/schema.sql and the seed files to the Supabase
 * project through the Management API SQL endpoint.
 *
 * Usage:  node scripts/apply-db.mjs            (schema + seed)
 *         node scripts/apply-db.mjs seed       (seed only)
 *         node scripts/apply-db.mjs schema     (schema only)
 *
 * Requires SUPABASE_ACCESS_TOKEN (sbp_…) and SUPABASE_PROJECT_REF in the
 * environment (falls back to .env at the repo root).
 */
import { readFileSync, existsSync } from "node:fs";

const root = new URL("..", import.meta.url);

/* Tiny .env loader (no deps). */
if (existsSync(new URL(".env", root))) {
  for (const line of readFileSync(new URL(".env", root), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const REF = process.env.SUPABASE_PROJECT_REF;
if (!TOKEN || !REF) {
  console.error("SUPABASE_ACCESS_TOKEN / SUPABASE_PROJECT_REF missing");
  process.exit(1);
}

const URL_API = `https://api.supabase.com/v1/projects/${REF}/database/query`;

async function run(sql, label) {
  const t0 = Date.now();
  const res = await fetch(URL_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`✗ ${label} — HTTP ${res.status}`);
    console.error(text.slice(0, 4000));
    process.exit(1);
  }
  /* The endpoint returns the result of the LAST statement; for DDL/inserts
     that is usually empty or a small array. Errors inside the script come
     back as HTTP errors (PGRST/API text), handled above. */
  console.log(`✓ ${label} (${((Date.now() - t0) / 1000).toFixed(1)}s) ${text.slice(0, 120).replace(/\s+/g, " ")}`);
}

const mode = process.argv[2] ?? "all";

/* v3: the unified (Supabase Auth based) schema — applies ON TOP of an
   already-seeded v2 database. Renames the two colliding v2 tables, creates
   the v3 tables + RLS policies, migrates content. See db/schema-v3.sql. */
if (mode === "v3") {
  await run(readFileSync(new URL("db/schema-v3.sql", root), "utf8"), "schema-v3.sql");
  console.log("done.");
  process.exit(0);
}

/* v3.1: auth migration — login verification fully in the database (Supabase
   Auth). Re-points the user FKs to auth.users and drops the legacy v2
   users table. See db/schema-v3.1-auth.sql. */
if (mode === "v3.1") {
  await run(readFileSync(new URL("db/schema-v3.1-auth.sql", root), "utf8"), "schema-v3.1-auth.sql");
  console.log("done.");
  process.exit(0);
}

if (mode === "all" || mode === "schema") {
  await run(readFileSync(new URL("db/schema.sql", root), "utf8"), "schema.sql");
}
if (mode === "all" || mode === "seed") {
  await run(readFileSync(new URL("db/seed-content.sql", root), "utf8"), "seed-content.sql");
  for (let i = 1; ; i += 1) {
    const file = new URL(`db/seed-i18n-${i}.sql`, root);
    if (!existsSync(file)) break;
    await run(readFileSync(file, "utf8"), `seed-i18n-${i}.sql`);
  }
}
console.log("done.");
