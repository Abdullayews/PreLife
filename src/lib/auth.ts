import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "@/i18n/navigation";
import { db } from "@/lib/db";

/**
 * PreLife auth — server-side session cookie + scrypt password hashing.
 * The session token is a stateless HMAC-signed payload (uid + expiry);
 */

const SECRET = process.env.AUTH_SECRET ?? "prelife-dev-secret-change-me";
export const SESSION_COOKIE = "pl_session";
export const SESSION_TTL_S = 60 * 60 * 24 * 30; // 30 days

/** The static test account (per product decision — replaced by real auth later). */

export type SessionUser = { id: string; email: string; name: string | null };

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

/* ── Session tokens (HMAC-SHA256, base64url payload) ──────────────────── */

type SessionPayload = { uid: string; exp: number };

export function createSessionToken(uid: string): string {
  const payload = Buffer.from(JSON.stringify({ uid, exp: Date.now() + SESSION_TTL_S * 1000 })).toString("base64url");
  const sig = createHmac("sha256", SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", SECRET).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString()) as SessionPayload;
    if (!parsed?.uid || typeof parsed.exp !== "number" || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

/* ── Current user (server components / route handlers) ────────────────── */

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const payload = verifySessionToken(store.get(SESSION_COOKIE)?.value);
  if (!payload) return null;
  try {
    const user = await db.user.findUnique({
      where: { id: payload.uid },
      select: { id: true, email: true, name: true },
    });
    return user;
  } catch {
    return null;
  }
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

