import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { buildContentTables, seedBaseRows } from "./seed";

/**
 * The local Supabase emulator — DEV ONLY (activated by SUPABASE_EMU=1).
 *
 * The production deployment talks to the real Supabase project
 * (PostgREST + GoTrue) through lib/server/supa.ts. This module plus the
 * routes under /api/supa-emu implement the same tiny API surface
 * in-process, so the sandbox preview runs the FULL app — auth, sessions,
 * content, user data — without any external service:
 *
 *   • content tables (worlds, gym, diet, psychologists, library,
 *     subscription, i18n_messages…) are re-seeded deterministically from
 *     the static content libs on every boot — exactly the rows
 *     scripts/export-content.mjs would emit;
 *   • user-data tables (sessions, profiles, journal_entries_v2, … plus
 *     the new ai_settings / ai_prompts / user_plans / custom_packages /
 *     email_verifications / mail_outbox) persist to db/emu-store.json
 *     (debounced write-through) and survive dev-server restarts;
 *   • auth.users lives as the `authUsers` array with GoTrue-shaped
 *     responses (password grant, admin create/update).
 *
 * The emulator is intentionally lenient: unknown tables answer `[]`,
 * filters support the ops lib/server/* actually uses (eq/neq/lt/lte/gt/
 * gte/is/in), and every insert gets an id + timestamps when missing.
 */

export type Row = Record<string, unknown>;

const DATA_DIR = path.join(process.cwd(), "db");
const STORE_FILE = path.join(DATA_DIR, "emu-store.json");

/** Tables whose rows survive restarts (user data + editable config). */
export const PERSISTED_TABLES = [
  "sessions", "profiles", "journal_entries_v2", "mood_logs", "quiz_results",
  "meditation_progress", "appointments", "user_weight_logs", "custom_packages",
  "user_plans", "email_verifications", "mail_outbox", "ai_settings", "ai_prompts",
] as const;

export type EmuData = {
  version: number;
  authUsers: Row[];
  tables: Record<string, Row[]>;
};

type EmuGlobal = {
  data?: EmuData;
  timer?: ReturnType<typeof setTimeout>;
};
const G = globalThis as unknown as { __prelifeEmu?: EmuGlobal };
const g: EmuGlobal = (G.__prelifeEmu ??= {});

/** True when the emulator is switched on (dev only). The NODE_ENV
 * guard is load-bearing (v4.7): a stray SUPABASE_EMU=1 in a production
 * env must not expose the emulator's unauthenticated admin surface. */
export function emuEnabled(): boolean {
  return process.env.SUPABASE_EMU === "1" && process.env.NODE_ENV !== "production";
}

/* ── persistence ─────────────────────────────────────────────────────────── */

type PersistedFile = { version?: number; authUsers?: Row[]; tables?: Record<string, Row[]> };

function loadPersisted(): PersistedFile {
  try {
    if (existsSync(STORE_FILE)) {
      const raw = JSON.parse(readFileSync(STORE_FILE, "utf8")) as PersistedFile;
      return raw && typeof raw === "object" ? raw : {};
    }
  } catch (e) {
    console.error("[emu] store file unreadable — starting fresh:", e);
  }
  return {};
}

function persistSoon(): void {
  if (g.timer) return;
  g.timer = setTimeout(() => {
    g.timer = undefined;
    const data = g.data;
    if (!data) return;
    try {
      const out: PersistedFile = { version: 1, authUsers: data.authUsers, tables: {} };
      for (const t of PERSISTED_TABLES) out.tables![t] = data.tables[t] ?? [];
      mkdirSync(DATA_DIR, { recursive: true });
      writeFileSync(STORE_FILE, JSON.stringify(out));
    } catch (e) {
      console.error("[emu] persist failed:", e);
    }
  }, 400);
}

/* ── boot / access ───────────────────────────────────────────────────────── */

/** The singleton store — builds (seed + restore) on first touch. */
export function emuData(): EmuData {
  if (g.data) return g.data;

  const persisted = loadPersisted();
  const tables: Record<string, Row[]> = { ...buildContentTables() };
  for (const t of PERSISTED_TABLES) tables[t] = persisted.tables?.[t] ?? [];

  const authUsers = persisted.authUsers ?? [];
  seedBaseRows(tables, authUsers); // ai_settings / ai_prompts

  g.data = { version: 1, authUsers, tables };
  return g.data;
}

/** Public helper for mutations: touch + schedule the write-through. */
export function emuTouch(): void {
  emuData();
  persistSoon();
}

/* ── row helpers ─────────────────────────────────────────────────────────── */

function nowIso(): string {
  return new Date().toISOString();
}

/** Insert one row (id / timestamps filled when missing) into a table. */
export function emuInsert(table: string, body: Row): Row {
  const data = emuData();
  const list = data.tables[table] ?? (data.tables[table] = []);
  const row: Row = { ...body };
  if (row.id === undefined || row.id === null || row.id === "") row.id = randomUUID();
  if (row.created_at === undefined) row.created_at = nowIso();
  if (row.updated_at === undefined) row.updated_at = row.created_at;
  list.push(row);
  persistSoon();
  return row;
}

/* ── passwords (local emulator only — not a real auth service) ───────────── */

export function emuHashPassword(pw: string, salt?: string): string {
  const s = salt ?? randomUUID().slice(0, 8);
  return `${s}$${createHash("sha256").update(s + pw).digest("hex")}`;
}

export function emuVerifyPassword(pw: string, stored: unknown): boolean {
  if (typeof stored !== "string" || !stored.includes("$")) return false;
  const [s] = stored.split("$");
  return emuHashPassword(pw, s) === stored;
}

/* ── GoTrue-shaped user ──────────────────────────────────────────────────── */

export function gotrueUser(u: Row): Row {
  return {
    id: u.id,
    aud: "authenticated",
    role: "authenticated",
    email: u.email,
    phone: "",
    email_confirmed: u.email_confirmed === true,
    confirmed_at: u.email_confirmed === true ? u.created_at ?? null : null,
    last_sign_in_at: u.last_sign_in_at ?? null,
    user_metadata: u.user_metadata ?? {},
    // Rows created by the OAuth consent dance carry their provider set
    // ({ provider: "google", providers: ["google"] }); everyone else is
    // a classic e-mail account.
    app_metadata: u.app_metadata && typeof u.app_metadata === "object"
      ? (u.app_metadata as Row)
      : { provider: "email", providers: ["email"] },
    created_at: u.created_at ?? null,
    updated_at: u.updated_at ?? u.created_at ?? null,
  };
}
