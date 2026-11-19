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
};

export type CurrentSession = {
  sessionId: string;
  deviceName: string;
  deviceIcon: string;
  user: SessionUser;
};

export function userView(u: SessionUser): {
  id: string; email: string; name: string | null; avatar: string | null; railFolded: boolean;
} {
  return { id: u.id, email: u.email, name: u.name, avatar: u.avatar ?? null, railFolded: u.railFolded ?? false };
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
): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const ua = userAgent ?? "";
  const { name, icon } = defaultDevice(ua);
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_TTL_S * 1000);

  // v3.3: the avatar + rail-fold choice ride on the session row too (read
  // from the profiles row at login) so the shell renders them with zero
  // extra lookups on the hot path.
  let avatar: string | null = null;
  let railFolded = false;
  try {
    const prof = await supaSelectOne("profiles", [
      ["select", "avatar_url,rail_folded"],
      ["id", `eq.${user.id}`],
    ]);
    if (prof) {
      avatar = typeof prof.avatar_url === "string" ? prof.avatar_url : null;
      railFolded = prof.rail_folded === true;
    }
  } catch {
    /* profile row may lag — the session still works */
  }

  await supaInsert("sessions", {
    user_id: user.id,
    user_email: user.email,
    user_name: user.name,
    user_avatar: avatar,
    user_folded: railFolded,
    token_hash: sha256Hex(token),
    device_name: name,
    device_icon: icon,
    user_agent: ua ? ua.slice(0, 300) : null,
    expires_at: expires.toISOString(),
  });
  return token;
}

/** Validates the cookie token: rejects unknown/expired sessions (deleting
 * the dead row) and slides the expiry forward past the throttle window. */
export async function loadSession(token: string): Promise<CurrentSession | null> {
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
    },
  };
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

/** The pl_oauth verifier from a raw Cookie header value, if present. */
export function oauthVerifierFromCookieHeader(raw: string | null): string | null {
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const p = part.trim();
    if (p.startsWith(`${OAUTH_COOKIE}=`)) return p.slice(OAUTH_COOKIE.length + 1);
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

export function oauthCookie(verifier: string, secure: boolean) {
  return {
    name: OAUTH_COOKIE,
    value: verifier,
    path: "/",
    maxAge: OAUTH_TTL_S,
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
  };
}

/** Delete the session row behind a cookie token (logout). */
export async function revokeTokenSession(token: string): Promise<void> {
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
