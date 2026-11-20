import {
  supaDelete,
  supaSelect,
  supaSelectOne,
  supaUpdate,
} from "./supa";
import { ApiCode, badRequest, notFound } from "./psych-data";
import {
  sessionCacheDropSession,
  sessionCacheDropUser,
  type CurrentSession,
} from "./session";

/**
 * Account endpoints — devices (Settings → Devices) and the account-tier
 * preferences (language + theme on the profiles row). Direct port of the
 * Rust auth.rs tail.
 */

type Row = Record<string, unknown>;

/* ── User preferences (language + theme + rail fold + content location on
 * the profiles row) ── */

/* v4.1: UserPrefsSync pulls GET /api/me/preferences after every page
 * navigation, so the profiles read is cached for 30s per user — the
 * session cookie is validated from the session cache too, which turns
 * the once-per-pageview REST fan-out into zero calls on the hot path.
 * PATCH drops the entry, so a saved change is visible immediately. */
const PREFS_CACHE_TTL_MS = 30_000;
const prefsCache = new Map<string, { at: number; v: Record<string, unknown> }>();

function prefsView(row: Row | null): Record<string, unknown> {
  return {
    locale: typeof row?.lang === "string" ? row.lang : "en",
    theme: typeof row?.theme === "string" ? row.theme : "light",
    railFolded: row?.rail_folded === true,
    contentLocation: row?.content_location === "az" ? "az" : "global",
  };
}

export async function preferencesGet(user: { id: string }) {
  const hit = prefsCache.get(user.id);
  if (hit && Date.now() - hit.at < PREFS_CACHE_TTL_MS) return hit.v;
  const row = await supaSelectOne("profiles", [
    ["select", "lang,theme,rail_folded,content_location"],
    ["id", `eq.${user.id}`],
  ]);
  const v = prefsView(row);
  prefsCache.set(user.id, { at: Date.now(), v });
  return v;
}

/** Drop the cached preferences view for one user — profile PATCHes can
 * change lang / theme through /api/me/profile too. */
export function prefsCacheDrop(userId: string): void {
  prefsCache.delete(userId);
}

export async function preferencesUpdate(user: { id: string }, body: Row) {
  const patch: Row = {};
  if (typeof body.locale === "string") {
    if (!["az", "en", "ru"].includes(body.locale)) throw badRequest();
    patch.lang = body.locale;
  }
  if (typeof body.theme === "string") {
    if (!["light", "dark"].includes(body.theme)) throw badRequest();
    patch.theme = body.theme;
  }
  if (body.railFolded !== undefined) {
    if (typeof body.railFolded !== "boolean") throw badRequest();
    patch.rail_folded = body.railFolded;
  }
  if (body.contentLocation !== undefined) {
    if (body.contentLocation !== "global" && body.contentLocation !== "az") throw badRequest();
    patch.content_location = body.contentLocation;
  }
  if (Object.keys(patch).length === 0) {
    throw new ApiCode(400, "nothing_to_update");
  }
  const rows = await supaUpdate("profiles", [["id", `eq.${user.id}`]], patch);

  // v4.1: both caches must drop — the prefs view reads the same profiles
  // row, and the session cache holds copies of the mirrored fields.
  prefsCache.delete(user.id);
  sessionCacheDropUser(user.id);

  // v3.3: the rail fold also rides on the session rows so the next server
  // render of any page picks it up with zero extra lookups.
  if (typeof patch.rail_folded === "boolean") {
    await supaUpdate("sessions", [["user_id", `eq.${user.id}`]], {
      user_folded: patch.rail_folded,
    }).catch(() => {});
  }

  // v3.4: the content-scope choice rides on the session rows the same way —
  // server pages filter halls/venues/stores/psychologists by it with zero
  // extra lookups per render.
  if (typeof patch.content_location === "string") {
    await supaUpdate("sessions", [["user_id", `eq.${user.id}`]], {
      user_location: patch.content_location,
    }).catch(() => {});
  }

  return prefsView(rows[0] ?? null);
}

/* ── Devices (Settings → Devices) ────────────────────────────────────────── */

function deviceView(row: Row, currentId: string) {
  const id = typeof row.id === "string" ? row.id : "";
  return {
    id,
    name: row.device_name,
    icon: row.device_icon,
    current: id === currentId,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
  };
}

export async function devicesList(current: CurrentSession) {
  const now = new Date().toISOString();
  await supaDelete("sessions", [
    ["user_id", `eq.${current.user.id}`],
    ["expires_at", `lt.${now}`],
  ]).catch(() => {});

  const rows = (await supaSelect("sessions", [
    ["select", "*"],
    ["user_id", `eq.${current.user.id}`],
    ["order", "last_used_at.desc"],
  ])) as Row[];

  return { devices: rows.map((r) => deviceView(r, current.sessionId)) };
}

async function ownSession(current: CurrentSession, id: string): Promise<Row> {
  const target = await supaSelectOne("sessions", [
    ["select", "*"], ["id", `eq.${id}`],
  ]);
  if (!target || target.user_id !== current.user.id) {
    throw notFound();
  }
  return target;
}

export async function deviceUpdate(
  current: CurrentSession,
  id: string,
  body: Row,
  validIcons: readonly string[],
) {
  const target = await ownSession(current, id);
  const targetId = typeof target.id === "string" ? target.id : "";

  const patch: Row = {};
  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name || [...name].length > 40) throw badRequest();
    patch.device_name = name;
  }
  if (typeof body.icon === "string") {
    if (!validIcons.includes(body.icon)) throw badRequest();
    patch.device_icon = body.icon;
  }
  if (Object.keys(patch).length === 0) {
    throw new ApiCode(400, "nothing_to_update");
  }

  const rows = await supaUpdate("sessions", [["id", `eq.${targetId}`]], patch);
  const row = rows[0];
  if (!row) throw notFound();
  // The cached session for that row still carries the old name/icon.
  sessionCacheDropSession(targetId);
  return { device: deviceView(row, current.sessionId) };
}

export async function deviceRevoke(current: CurrentSession, id: string) {
  await ownSession(current, id);
  await supaDelete("sessions", [["id", `eq.${id}`]]);
  // Drop the revoked row's cached entry so its cookie dies instantly.
  sessionCacheDropSession(id);
  return { ok: true, current: id === current.sessionId };
}
