import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { defaultDeviceIcon, defaultDeviceName } from "@/lib/devices";

/**
 * PreLife auth — server-side session cookie + scrypt password hashing.
 *
 * Sessions are DB-backed rows (Settings → Devices): the cookie carries a
 * 256-bit random token, only its SHA-256 hash is stored. Expiry slides
 * forward on activity, so an active visitor is never signed out
 * automatically — the session lives a full year and renews itself.
 */

export const SESSION_COOKIE = "pl_session";
export const SESSION_TTL_S = 60 * 60 * 24 * 365; // 1 year, sliding
/** Sliding-renewal throttle: lastUsedAt/expiresAt are refreshed at most
 *  once an hour, so most visits cost zero extra DB writes. */
const RENEW_EVERY_MS = 60 * 60 * 1000;

/** The static test account (per product decision — replaced by real auth later). */

export type SessionUser = { id: string; email: string; name: string | null };
export type CurrentSession = {
  session: { id: string; deviceName: string; deviceIcon: string };
  user: SessionUser;
};

/* ── Passwords (scrypt, no external deps) ─────────────────────────────── */

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

/* ── Sessions (random token, SHA-256 hash in the DB, sliding expiry) ──── */

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** Signs a device in: creates the Session row (default name/icon from the
 *  User-Agent) and returns the token for the cookie. */
export async function createSession(userId: string, userAgent: string | null): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.session.create({
    data: {
      userId,
      tokenHash: sha256(token),
      deviceName: defaultDeviceName(userAgent),
      deviceIcon: defaultDeviceIcon(userAgent),
      userAgent: userAgent ? userAgent.slice(0, 300) : null,
      expiresAt: new Date(Date.now() + SESSION_TTL_S * 1000),
    },
  });
  return token;
}

/** Deletes the session a token points at (logout / device revoke). */
export async function revokeSessionByToken(token: string): Promise<void> {
  await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
}

/** Validates the cookie token against the DB: rejects unknown/expired
 *  sessions (deleting the dead row) and slides the expiry forward when
 *  the throttle window has passed. */
async function loadSession(token: string | undefined | null): Promise<CurrentSession | null> {
  if (!token) return null;
  try {
    const row = await db.session.findUnique({
      where: { tokenHash: sha256(token) },
      include: { user: { select: { id: true, email: true, name: true } } },
    });
    if (!row) return null;
    if (row.expiresAt.getTime() <= Date.now()) {
      await db.session.delete({ where: { id: row.id } }).catch(() => {});
      return null;
    }
    if (Date.now() - row.lastUsedAt.getTime() > RENEW_EVERY_MS) {
      await db.session
        .update({
          where: { id: row.id },
          data: { lastUsedAt: new Date(), expiresAt: new Date(Date.now() + SESSION_TTL_S * 1000) },
        })
        .catch(() => {});
    }
    return {
      session: { id: row.id, deviceName: row.deviceName, deviceIcon: row.deviceIcon },
      user: row.user,
    };
  } catch {
    return null;
  }
}

/* ── Current user (server components / route handlers) ────────────────── */

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const current = await loadSession(store.get(SESSION_COOKIE)?.value);
  return current?.user ?? null;
}

/** The current session + user — used by the Devices API to mark "this
 *  device" and to guard device rows against foreign users. */
export async function getSession(): Promise<CurrentSession | null> {
  const store = await cookies();
  return loadSession(store.get(SESSION_COOKIE)?.value);
}

/**
 * Page guard: without a valid session the visitor is sent to the login
 * page (with a `next` param so sign-in returns them where they wanted
 * to go). Used by every protected main page — /home, /gym, /diet, …
 */
export async function requireUser(locale: string, next?: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    redirect({ href: next ? `/login?next=${encodeURIComponent(next)}` : "/login", locale });
    // redirect() throws NEXT_REDIRECT in server components, so `user` is
    // never null past this point. The assertion only satisfies plain tsc,
    // which resolves next-intl's *client* redirect type (void, not never).
    throw new Error("unreachable");
  }
  return user;
}

