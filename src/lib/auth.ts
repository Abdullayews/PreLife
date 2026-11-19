import { headers } from "next/headers";
import { redirect } from "@/i18n/navigation";
import { currentSessionFromHeaders } from "./server/session";

/**
 * PreLife auth — the merged backend identifies the current visitor for
 * server components straight from the cookie session (public.sessions,
 * which also powers the Devices screen). Credentials live in Supabase
 * Auth (auth.users + profiles) and are verified by the /api/auth routes.
 */

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  /** Profile photo (data URL) riding on the session row (v3.3). */
  avatar: string | null;
  /** The rail fold choice riding on the session row (v3.3). */
  railFolded: boolean;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const h = await headers();
    const cs = await currentSessionFromHeaders(h);
    return cs
      ? {
        id: cs.user.id,
        email: cs.user.email,
        name: cs.user.name,
        avatar: cs.user.avatar ?? null,
        railFolded: cs.user.railFolded ?? false,
      }
      : null;
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
