import { headers } from "next/headers";
import { redirect } from "@/i18n/navigation";

/**
 * PreLife auth — thin server-side client for the Rust backend.
 *
 * Password hashing, sessions and device rows all live in the prelife-api
 * service (Rust) + Supabase Postgres now; this module just identifies the
 * current visitor for server components: the browser cookie is forwarded
 * to /api/auth/me, which returns the session user or — per the V1 product
 * until real auth gating returns.
 */

const API_BASE = process.env.PRELIFE_API_URL ?? "http://127.0.0.1:3031";

export type SessionUser = { id: string; email: string; name: string | null };

export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const h = await headers();
    const cookie = h.get("cookie");
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      cache: "no-store",
      headers: cookie ? { cookie } : undefined,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { user?: SessionUser | null };
    return data.user ?? null;
  } catch {
    return null;
  }
}

/**
 * Page guard: without a valid session the visitor is sent to the login
 * page (with a `next` param so sign-in returns them where they wanted to
 * go). Used by every protected main page — /home, /gym, /diet, …
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
