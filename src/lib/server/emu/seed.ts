import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { emuHashPassword, type Row } from "./store";
import { AI_PROMPT_SEEDS } from "../ai-prompts";

/**
 * Emulator seeding — parses the CANONICAL content snapshot (db/seed-content.sql,
 * the same file scripts/apply-db.mjs applies to the production database) into
 * table rows, so lib/server/content.ts assembles identical JSON from the
 * emulator as from the cloud. On top of the snapshot:
 *
 *   • psychologists → psychologists_v2 (the rename the v3 migration applied
 *     in production — content.ts reads the _v2 name);
 *   • subscription_tiers prices are overridden to the v3.3 sheet
 *     (Plus 15 ₼ / Pro 40 ₼ / Ultra 60 ₼);
 *   • i18n_messages is built from messages/*.json (fresher than the last
 *     SQL export; request.ts merges DB-over-static either way);
 *   • seedBaseRows() fills the persisted tables only when they are empty
 *     (AI settings + prompts).
 *
 * The SQL here is the machine-generated dialect of export-content.mjs:
 * INSERT INTO t (cols) VALUES (…),(…); with '…' strings ('' escapes),
 * NULL, true/false, numbers, ARRAY['…']::text[] and '…'::jsonb.
 */

const nowIso = () => new Date().toISOString();

/* ══ The tiny seed-SQL parser ═══════════════════════════════════════════ */

/** Split a script into statements (';' outside strings ends a statement).
 *  Line comments (`-- …`) are skipped outside strings. */
function splitStatements(sql: string): string[] {
  const out: string[] = [];
  let buf = "";
  let inStr = false;
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i]!;
    if (inStr) {
      buf += c;
      if (c === "'") {
        if (sql[i + 1] === "'") buf += sql[i++ + 1]!; // '' escape
        else inStr = false;
      }
      continue;
    }
    if (c === "'") {
      inStr = true;
      buf += c;
      continue;
    }
    if (c === "-" && sql[i + 1] === "-") {
      // line comment — skip to the newline
      while (i < sql.length && sql[i] !== "\n") i++;
      continue;
    }
    if (c === ";") {
      out.push(buf);
      buf = "";
      continue;
    }
    buf += c;
  }
  if (buf.trim()) out.push(buf);
  return out;
}

/** One SQL literal → a JS value. */
function parseValue(raw: string): unknown {
  const s = raw.trim();
  if (s === "NULL" || s === "") return null;
  if (s === "true") return true;
  if (s === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);

  if (s.startsWith("'")) {
    // 'text' with '' escapes, optionally followed by ::jsonb / ::text
    let out = "";
    let i = 1;
    for (; i < s.length; i++) {
      const c = s[i]!;
      if (c === "'") {
        if (s[i + 1] === "'") {
          out += "'";
          i++;
          continue;
        }
        break;
      }
      out += c;
    }
    const suffix = s.slice(i + 1).trim();
    if (suffix.startsWith("::jsonb")) {
      try {
        return JSON.parse(out);
      } catch {
        return out;
      }
    }
    return out;
  }

  if (s.startsWith("ARRAY[")) {
    const inner = s.slice(6, s.lastIndexOf("]"));
    const elems: unknown[] = [];
    let buf = "";
    let inStr = false;
    const flush = () => {
      const t = buf.trim();
      buf = "";
      if (!t) return;
      if (t.startsWith("'")) elems.push(parseValue(t));
      else elems.push(parseValue(t));
    };
    for (let i = 0; i < inner.length; i++) {
      const c = inner[i]!;
      if (inStr) {
        buf += c;
        if (c === "'") {
          if (inner[i + 1] === "'") buf += inner[i++ + 1]!;
          else inStr = false;
        }
        continue;
      }
      if (c === "'") {
        inStr = true;
        buf += c;
        continue;
      }
      if (c === ",") {
        flush();
        continue;
      }
      buf += c;
    }
    flush();
    return elems;
  }

  return s; // unknown literal — keep the raw text
}

/** Split a tuple body "(a, b, (c))"-style into its top-level value texts. */
function splitValues(inner: string): string[] {
  const out: string[] = [];
  let buf = "";
  let depth = 0;
  let inStr = false;
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i]!;
    if (inStr) {
      buf += c;
      if (c === "'") {
        if (inner[i + 1] === "'") buf += inner[i++ + 1]!;
        else inStr = false;
      }
      continue;
    }
    if (c === "'") {
      inStr = true;
      buf += c;
      continue;
    }
    if (c === "(" || c === "[") depth++;
    if (c === ")" || c === "]") depth--;
    if (c === "," && depth === 0) {
      out.push(buf);
      buf = "";
      continue;
    }
    buf += c;
  }
  if (buf.trim()) out.push(buf);
  return out;
}

/** "INSERT INTO t (c1, c2) VALUES (v1, v2), (…);" → rows. */
function parseInsert(stmt: string): { table: string; rows: Row[] } | null {
  const m = /^INSERT INTO ([a-z_0-9]+) \(([^)]+)\) VALUES\s*([\s\S]+)$/.exec(stmt.trim());
  if (!m) return null;
  const table = m[1]!;
  const cols = m[2]!.split(",").map((c) => c.trim());
  let body = m[3]!.trim();
  if (body.endsWith(";")) body = body.slice(0, -1);

  const rows: Row[] = [];
  let tuple = "";
  let started = false;
  let depth = 0;
  let inStr = false;
  for (let i = 0; i < body.length; i++) {
    const c = body[i]!;
    if (inStr) {
      tuple += c;
      if (c === "'") {
        if (body[i + 1] === "'") tuple += body[i++ + 1]!;
        else inStr = false;
      }
      continue;
    }
    if (c === "'") {
      inStr = true;
      tuple += c;
      continue;
    }
    if (c === "(") {
      depth++;
      if (depth === 1) {
        started = true;
        tuple = "";
        continue;
      }
    }
    if (c === ")") {
      depth--;
      if (depth === 0) {
        const vals = splitValues(tuple);
        const row: Row = {};
        cols.forEach((col, ci) => { row[col] = parseValue(vals[ci] ?? "NULL"); });
        rows.push(row);
        tuple = "";
        continue;
      }
    }
    if (started) tuple += c;
  }
  return { table, rows };
}

/* ══ Content tables ═════════════════════════════════════════════════════ */

export function buildContentTables(): Record<string, Row[]> {
  const t: Record<string, Row[]> = {};

  const seedFile = path.join(process.cwd(), "db", "seed-content.sql");
  if (existsSync(seedFile)) {
    const sql = readFileSync(seedFile, "utf8");
    for (const stmt of splitStatements(sql)) {
      const parsed = parseInsert(stmt);
      if (!parsed) continue; // TRUNCATE / setval / comments
      const target = parsed.table === "psychologists" ? "psychologists_v2" : parsed.table;
      t[target] = [...(t[target] ?? []), ...parsed.rows];
    }
  } else {
    console.error("[emu] db/seed-content.sql not found — content tables stay empty");
  }

  /* The v3.3 price sheet (the snapshot predates it). */
  if (Array.isArray(t.subscription_tiers)) {
    const priceByCode: Record<string, number> = { plus: 15, pro: 40, ultra: 60 };
    for (const row of t.subscription_tiers) {
      if (typeof row.code === "string" && row.code in priceByCode) {
        row.price = priceByCode[row.code];
      }
    }
  }

  /* i18n — flattened from messages/*.json (fresh, incl. just-added keys). */
  t.i18n_messages = buildI18nRows();

  return t;
}

/* ── i18n rows ─────────────────────────────────────────────────────────── */

function flatten(obj: Record<string, unknown>, prefix = "", out: Record<string, string> = {}): Record<string, string> {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) flatten(v as Record<string, unknown>, key, out);
    else out[key] = String(v);
  }
  return out;
}

function readCatalog(locale: string): Record<string, string> {
  const file = path.join(process.cwd(), "messages", `${locale}.json`);
  if (!existsSync(file)) return {};
  try {
    return flatten(JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>);
  } catch {
    return {};
  }
}

function buildI18nRows(): Row[] {
  const catalogs: Record<string, Record<string, string>> = {
    az: readCatalog("az"), en: readCatalog("en"), ru: readCatalog("ru"),
  };
  const allKeys = [...new Set([...Object.keys(catalogs.az), ...Object.keys(catalogs.en), ...Object.keys(catalogs.ru)])].sort();
  const pick = (locale: string, key: string) =>
    catalogs[locale][key] ?? catalogs.az[key] ?? catalogs.en[key] ?? catalogs.ru[key] ?? "";
  return allKeys.map((key) => ({
    key, value_az: pick("az", key), value_en: pick("en", key), value_ru: pick("ru", key),
  }));
}

/* ══ Base rows for the persisted tables (seed-once) ═════════════════════ */


export function seedBaseRows(tables: Record<string, Row[]>, authUsers: Row[]): void {
  const now = nowIso();

  /* ai_settings — the Gemini provider (env key wins at read time too). */
  if (!tables.ai_settings?.length) {
    tables.ai_settings = [{
      id: randomUUID(),
      provider: "gemini",
      api_key: process.env.GEMINI_API_KEY ?? "",
      model: process.env.GEMINI_MODEL ?? "gemini-flash-lite-latest",
      is_active: true,
      created_at: now, updated_at: now,
    }];
  }

  /* ai_prompts — the catalog from lib/server/ai-prompts.ts. */
  if (!tables.ai_prompts?.length) {
    tables.ai_prompts = AI_PROMPT_SEEDS.map(({ key, content }) => ({
      id: randomUUID(), key, content, is_active: true, created_at: now, updated_at: now,
    }));
  }

}
