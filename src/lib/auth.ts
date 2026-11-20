import { redirect } from "@/i18n/navigation";
import { apiGet } from "./server-api";

/**
 * PreLife auth — the Rust backend (mini-services/prelife-api) owns the
 * cookie sessions (public.sessions, which also powers the Devices
 * screen). The merged Next.js app resolves the current visitor for
 * server components through /api/auth/me — the same endpoint the client
 * uses, answered from the backend's 30s session cache.
 */

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  /** Profile photo (data URL) riding on the session row (v3.3). */
  avatar: string | null;
  /** The rail fold choice riding on the session row (v3.3). */
  railFolded: boolean;
  /** v3.4: account role — 'psychologist' links to a psychologists_v2 row. */
  role: "user" | "psychologist";
  /** v3.4: the linked psychologist slug (when role === 'psychologist'). */
  psychSlug: string | null;
  /** v3.4: content-scope choice (global | az) riding on the session row. */
  location: "global" | "az";
};

/** /api/auth/me's user view — the SessionUser shape verbatim. */
type MeResponse = { user: SessionUser | null };

export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const me = await apiGet<MeResponse>("/api/auth/me");
    const user = me?.user ?? null;
    if (!user || typeof user.id !== "string" || typeof user.email !== "string") {
      return null;
    }
    return {
      id: user.id,
      email: user.email,
      name: user.name ?? null,
      avatar: user.avatar ?? null,
      railFolded: user.railFolded ?? false,
      role: user.role === "psychologist" ? "psychologist" : "user",
      psychSlug: user.psychSlug ?? null,
      location: user.location === "az" ? "az" : "global",
    };
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
