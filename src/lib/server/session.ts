import { createHash, randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";
import {
  supaDelete,
  supaInsert,
  supaSelectOne,
  supaUpdate,
  type AuthUser,
} from "./supa";

/**
 * Cookie sessions for the merged app — the direct port of the Rust
 * auth.rs session layer. Accounts live in Supabase Auth (auth.users +
 * profiles); this module mints the site's own `pl_session` cookie whose
 * row in public.sessions also powers the Devices screen (Settings).
 * Existing cookies keep working: same name, same token hashing.
 */

export const SESSION_COOKIE = "pl_session";
export const SESSION_TTL_S = 60 * 60 * 24 * 365; // 1 year, sliding
const RENEW_EVERY_MS = 60 * 60 * 1000; // refresh at most once an hour

export const OAUTH_COOKIE = "pl_oauth";
export const OAUTH_TTL_S = 600;
const DEVICE_ICONS = [
  "monitor", "laptop", "smartphone", "tablet", "watch",
  "tv", "gamepad", "headphones", "briefcase", "home",
];

export type SessionUser = AuthUser & {
  /** Profile avatar (data URL) riding on the session row (v3.3). */
  avatar?: string | null;
  /** The rail fold choice riding on the session row (v3.3). */
  railFolded?: boolean;
  /** v3.4: account role — 'psychologist' links to a psychologists_v2 row. */
  role?: "user" | "psychologist" | null;
  /** v3.4: the psychologist slug when role === 'psychologist'. */
  psychSlug?: string | null;
  /** v3.4: the content-scope choice (global | az) from the profile row. */
  location?: string | null;
};

export type CurrentSession = {
  sessionId: string;
  deviceName: string;
  deviceIcon: string;
  user: SessionUser;
};

export function userView(u: SessionUser): {
  id: string; email: string; name: string | null; avatar: string | null; railFolded: boolean;
  role: "user" | "psychologist"; psychSlug: string | null; location: "global" | "az";
} {
  return {
    id: u.id, email: u.email, name: u.name, avatar: u.avatar ?? null, railFolded: u.railFolded ?? false,
    role: u.role === "psychologist" ? "psychologist" : "user",
    psychSlug: u.role === "psychologist" && typeof u.psychSlug === "string" ? u.psychSlug : null,
    location: u.location === "az" ? "az" : "global",
  };
}

/* ── Device identification (mirrors src/lib/devices.ts) ─────────────────── */

function describeUa(ua: string): { kind: string; os: string; browser: string } {
  const l = ua.toLowerCase();
  const tablet = l.includes("ipad") || l.includes("tablet")
    || l.includes("playbook") || l.includes("silk")
    || (l.includes("android") && !l.includes("mobile"));
  const mobile = !tablet
    && (l.includes("mobi") || l.includes("iphone") || l.includes("ipod")
      || l.includes("android") || l.includes("windows phone"));
  const kind = tablet ? "tablet" : mobile ? "mobile" : "desktop";

  const os = l.includes("windows") ? "Windows"
    : l.includes("iphone") || l.includes("ipad") || l.includes("ipod") ? "iOS"
    : l.includes("macintosh") || l.includes("mac os x") ? "macOS"
    : l.includes("android") ? "Android"
    : l.includes("linux") || l.includes("x11") ? "Linux"
    : "";

  const browser = l.includes("edg/") ? "Edge"
    : l.includes("opr/") || l.includes("opera") ? "Opera"
    : l.includes("chromium") ? "Chromium"
    : l.includes("chrome/") ? "Chrome"
    : l.includes("firefox") ? "Firefox"
    : l.includes("safari/") ? "Safari"
    : "";

  return { kind, os, browser };
}

export function defaultDevice(ua: string): { name: string; icon: string } {
  const { kind, os, browser } = describeUa(ua);
  const parts = [browser, os].filter(Boolean);
  const name = parts.length > 0
    ? parts.join(" · ")
    : kind === "mobile" ? "Mobile"
    : kind === "tablet" ? "Tablet"
    : "Desktop";
  const icon = kind === "mobile" ? "smartphone" : kind === "tablet" ? "tablet" : "monitor";
  return { name, icon };
}

export const DEVICE_ICON_CHOICES = DEVICE_ICONS;

/* ── Sessions ───────────────────────────────────────────────────────────── */

function sha256Hex(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export async function createSession(
  user: AuthUser,
  userAgent: string | null,
): Promise<{ token: string; user: SessionUser }> {
  const token = randomBytes(32).toString("base64url");
  const ua = userAgent ?? "";
  const { name, icon } = defaultDevice(ua);
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_TTL_S * 1000);

  // v3.3: the avatar + rail-fold choice ride on the session row too (read
  // from the profiles row at login) so the shell renders them with zero
  // extra lookups on the hot path. v3.4 adds the role (user |
  // psychologist), the linked psychologist slug and the content-location
  // choice the same way. `select=*` keeps this working on databases where
  // the v3.3/v3.4 profiles columns do not exist yet.
  let avatar: string | null = null;
  let railFolded = false;
  let role: "user" | "psychologist" = "user";
  let psychSlug: string | null = null;
  let location = "global";
  try {
    const prof = await supaSelectOne("profiles", [
      ["select", "*"],
      ["id", `eq.${user.id}`],
    ]);
    if (prof) {
      avatar = typeof prof.avatar_url === "string" ? prof.avatar_url : null;
      railFolded = prof.rail_folded === true;
      role = prof.role === "psychologist" ? "psychologist" : "user";
      location = prof.content_location === "az" ? "az" : "global";
    }
    if (role === "psychologist") {
      const psy = await supaSelectOne("psychologists_v2", [
        ["select", "slug"],
        ["owner_id", `eq.${user.id}`],
      ]);
      psychSlug = psy && typeof psy.slug === "string" ? psy.slug : null;
      if (!psychSlug) role = "user"; // not actually linked — plain user
    }
  } catch {
    /* profile row may lag — the session still works */
  }

  const row: Record<string, unknown> = {
    user_id: user.id,
    user_email: user.email,
    user_name: user.name,
    user_avatar: avatar,
    user_folded: railFolded,
    user_role: role,
    user_psych: psychSlug,
    user_location: location,
    token_hash: sha256Hex(token),
    device_name: name,
    device_icon: icon,
    user_agent: ua ? ua.slice(0, 300) : null,
    expires_at: expires.toISOString(),
  };
  try {
    await supaInsert("sessions", row);
  } catch {
    /* Pre-v3.3 databases have no user_avatar/user_folded columns — drop
     * the newer ones and retry so login still works before the migration
     * runs. */
    const legacy = { ...row };
    delete legacy.user_avatar;
    delete legacy.user_folded;
    delete legacy.user_role;
    delete legacy.user_psych;
    delete legacy.user_location;
    await supaInsert("sessions", legacy);
  }
  /* The enriched session user — the same shape loadSession() returns, so
   * the login/signup/verify responses carry the real avatar, fold, role
   * and location instead of the GoTrue-only defaults. */
  return {
    token,
    user: {
      ...user,
      avatar,
      railFolded,
      role,
      psychSlug,
      location,
    },
  };
}

/* ── Session lookup cache (v4.1) ────────────────────────────────────────
 *
 * Every request — the [locale] layout, the page server component AND each
 * /api route — validated pl_session with a fresh SELECT on public.sessions.
 * One page view meant 4–7 identical REST calls (2 session selects per
 * render + 1 per client API call + the hourly renew write), which is what
 * made the Supabase "total requests" graph climb so steeply. This
 * per-process cache collapses the hot path to ~1 lookup per 30s window:
 *
 *  • valid sessions cache for 30s, unknown/expired tokens for 10s
 *    (negative entries protect the DB from cookie scanners);
 *  • concurrent lookups of the same token share one in-flight promise;
 *  • every writer that touches session rows (logout, device revoke /
 *    rename, profile & preference mirrors) drops the affected entries,
 *    so changes made by THIS process are visible on the very next
 *    request. A revocation issued by another process is honoured as soon
 *    as the short TTL lapses. */

const SESSION_CACHE_TTL_MS = 30_000;
const SESSION_CACHE_NEG_TTL_MS = 10_000;
const SESSION_CACHE_MAX = 5_000;

type SessionCacheEntry = {
  at: number;
  cs: CurrentSession | null;
  inflight?: Promise<CurrentSession | null>;
};

const sessionCache = new Map<string, SessionCacheEntry>();

/** Validates the cookie token: rejects unknown/expired sessions (deleting
 * the dead row) and slides the expiry forward past the throttle window.
 * Uncached — callers go through loadSession(). */
async function loadSessionRow(token: string): Promise<CurrentSession | null> {
  let row: Record<string, unknown> | null;
  try {
    row = await supaSelectOne("sessions", [
      ["select", "*"],
      ["token_hash", `eq.${sha256Hex(token)}`],
    ]);
  } catch {
    return null;
  }
  if (!row) return null;

  const now = Date.now();
  const expiresAt = typeof row.expires_at === "string" ? Date.parse(row.expires_at) : NaN;
  if (!Number.isFinite(expiresAt)) return null;
  if (expiresAt <= now) {
    const id = typeof row.id === "string" ? row.id : "";
    if (id) void supaDelete("sessions", [["id", `eq.${id}`]]).catch(() => {});
    return null;
  }

  const lastUsed = typeof row.last_used_at === "string" ? Date.parse(row.last_used_at) : now;
  if (!Number.isFinite(lastUsed) || now - lastUsed > RENEW_EVERY_MS) {
    const id = typeof row.id === "string" ? row.id : "";
    if (id) {
      void supaUpdate(
        "sessions",
        [["id", `eq.${id}`]],
        {
          last_used_at: new Date(now).toISOString(),
          expires_at: new Date(now + SESSION_TTL_S * 1000).toISOString(),
        },
      ).catch(() => {});
    }
  }

  // The user rides on the session row (user_email / user_name, and since
  // v3.3 user_avatar / user_folded) — written at login/signup straight
  // from the GoTrue response + profiles row, so the hot path needs no
  // extra lookup.
  const userId = row.user_id;
  const email = row.user_email;
  if (typeof userId !== "string" || typeof email !== "string") return null;
  return {
    sessionId: typeof row.id === "string" ? row.id : "",
    deviceName: typeof row.device_name === "string" ? row.device_name : "",
    deviceIcon: typeof row.device_icon === "string" ? row.device_icon : "monitor",
    user: {
      id: userId,
      email,
      name: typeof row.user_name === "string" ? row.user_name : null,
      avatar: typeof row.user_avatar === "string" ? row.user_avatar : null,
      railFolded: row.user_folded === true,
      role: row.user_role === "psychologist" ? "psychologist" : "user",
      psychSlug: typeof row.user_psych === "string" ? row.user_psych : null,
      location: row.user_location === "az" ? "az" : "global",
    },
  };
}

/** Cached session validation — see the cache block above. */
export async function loadSession(token: string): Promise<CurrentSession | null> {
  const key = sha256Hex(token);
  const hit = sessionCache.get(key);
  if (hit) {
    const ttl = hit.cs ? SESSION_CACHE_TTL_MS : SESSION_CACHE_NEG_TTL_MS;
    if (Date.now() - hit.at < ttl) return hit.cs; // fresh answer
    if (hit.inflight) return hit.inflight; // stale, refresh already running
  }

  // Someone else may have started the refresh between the two reads above.
  const running = sessionCache.get(key)?.inflight;
  if (running) return running;

  const inflight = loadSessionRow(token).then((cs) => {
    sessionCache.set(key, { at: Date.now(), cs });
    // Hard cap — unknown tokens (scanners, stale cookies) must not grow
    // the map without bound. Map keeps insertion order, so evict the
    // oldest entry that is not the one we just wrote.
    if (sessionCache.size > SESSION_CACHE_MAX) {
      for (const k of sessionCache.keys()) {
        if (k === key) continue;
        sessionCache.delete(k);
        break;
      }
    }
    return cs;
  });
  // Keep the previous answer (at its original timestamp) for callers that
  // race with the refresh — they should queue on the promise, not treat
  // the stale copy as fresh for another full window.
  sessionCache.set(key, { at: hit?.at ?? 0, cs: hit?.cs ?? null, inflight });
  return inflight;
}

/* Cache invalidation — called by every writer that touches session rows. */

/** Drop the cached answer for one cookie token (logout). */
export function sessionCacheDropToken(token: string): void {
  sessionCache.delete(sha256Hex(token));
}

/** Drop every cached entry that points at one session row (device revoke /
 * rename — the row id, not the token, identifies it). */
export function sessionCacheDropSession(sessionId: string): void {
  if (!sessionId) return;
  for (const [k, v] of sessionCache) {
    if (v.cs?.sessionId === sessionId) sessionCache.delete(k);
  }
}

/** Drop every cached entry of one user (profile / preference mirrors that
 * rewrite all their session rows at once). */
export function sessionCacheDropUser(userId: string): void {
  for (const [k, v] of sessionCache) {
    if (v.cs?.user.id === userId) sessionCache.delete(k);
  }
}

/* ── Cookie helpers ─────────────────────────────────────────────────────── */

/** The pl_session token from a raw Cookie header value, if present. */
export function tokenFromCookieHeader(raw: string | null): string | null {
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const p = part.trim();
    if (p.startsWith(`${SESSION_COOKIE}=`)) return p.slice(SESSION_COOKIE.length + 1);
  }
  return null;
}

/** The pl_oauth verifier from a raw Cookie header value, if present.
 * v4.3 packed the locale in front ("az.<verifier>"); v4.4 packs the
 * origin page and a mint stamp too
 * ("az.login.<minted-ms>.<verifier>"). Bare verifiers from a mid-flow
 * upgrade still parse. */
export function oauthVerifierFromCookieHeader(raw: string | null): string | null {
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const p = part.trim();
    if (!p.startsWith(`${OAUTH_COOKIE}=`)) continue;
    const v = p.slice(OAUTH_COOKIE.length + 1);
    return v
      .replace(/^[a-z]{2}\.(login|signup)\.\d{11,}\./, "")
      .replace(/^[a-z]{2}\.(login|signup)\./, "")
      .replace(/^[a-z]{2}\./, "");
  }
  return null;
}

export function isSecure(headers: Headers): boolean {
  return headers.get("x-forwarded-proto") === "https";
}

/** The current session from a NextRequest (route handlers). */
export async function currentSession(req: NextRequest): Promise<CurrentSession | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return loadSession(token);
}

/** The current session from a Headers object (server components — the
 * request's raw cookie header). */
export async function currentSessionFromHeaders(
  h: Headers,
): Promise<CurrentSession | null> {
  const token = tokenFromCookieHeader(h.get("cookie"));
  if (!token) return null;
  return loadSession(token);
}

/* ── Response cookie builders (NextResponse.cookies.set input) ─────────── */

export function sessionCookie(token: string, secure: boolean) {
  return {
    name: SESSION_COOKIE,
    value: token,
    path: "/",
    maxAge: SESSION_TTL_S,
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
  };
}

export function clearedSessionCookie(secure: boolean) {
  return {
    name: SESSION_COOKIE,
    value: "",
    path: "/",
    maxAge: 0,
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
  };
}

export function clearedOAuthCookie(secure: boolean) {
  return {
    name: OAUTH_COOKIE,
    value: "",
    path: "/",
    maxAge: 0,
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
  };
}

/** v4.4: the cookie value is "<locale>.<mode>.<minted-ms>.<verifier>" —
 * the mode (login | signup) records which page started the dance, and
 * the mint stamp (when the button was pressed) lets the callback tell
 * "the provider row this dance just created" apart from "a provider
 * account registered earlier" — provider signups leave real rows
 * behind now, and those must never be deleted as phantoms. */
export function oauthCookie(
  verifier: string,
  secure: boolean,
  locale = "az",
  mode: "login" | "signup" = "login",
) {
  return {
    name: OAUTH_COOKIE,
    value: `${locale}.${mode}.${Date.now()}.${verifier}`,
    path: "/",
    maxAge: OAUTH_TTL_S,
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
  };
}

/** Delete the session row behind a cookie token (logout). */
export async function revokeTokenSession(token: string): Promise<void> {
  sessionCacheDropToken(token);
  try {
    await supaDelete("sessions", [["token_hash", `eq.${sha256Hex(token)}`]]);
  } catch {
    /* already gone */
  }
}

/**
 * The public origin the browser sees (x-forwarded-host beats host; proto
 * from x-forwarded-proto). OAuth redirect_to must return there — the
 * server's own listen address is unreachable from the outside world.
 */
export function originFrom(headers: Headers): string {
  const proto = headers.get("x-forwarded-proto") || "http";
  const host = headers.get("x-forwarded-host") || headers.get("host") || "127.0.0.1:3000";
  return `${proto}://${host}`;
}
