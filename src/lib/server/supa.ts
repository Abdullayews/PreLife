/**
 * Minimal PostgREST + GoTrue client for Supabase using the service_role
 * key (bypasses RLS). Ported 1:1 from the Rust backend (prelife-api) so
 * the merged Next.js app talks to the database exactly like before —
 * same endpoints, same filters, same error strings.
 *
 * All requests are `no-store`: freshness is handled by the small TTL
 * cache in lib/server/ttl.ts (same 60s window the Rust service used).
 */

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/** False when SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set —
 * every DB-backed endpoint then answers 503 `supabase_unconfigured`
 * instead of failing with vague 500s. */
export const supabaseConfigured = Boolean(SUPABASE_URL && SERVICE_KEY);

const ROOT = SUPABASE_URL.replace(/\/+$/, "");
const REST = `${ROOT}/rest/v1`;
const AUTH = `${ROOT}/auth/v1`;

/** The GoTrue root ({SUPABASE_URL}/auth/v1) — used to build the
 * /authorize redirect for OAuth (google / apple). */
export const authBase = AUTH;

export type SupaParams = [string, string][];

const HDRS: Record<string, string> = {
  apikey: SERVICE_KEY,
  authorization: `Bearer ${SERVICE_KEY}`,
};

function qs(params: SupaParams): string {
  return new URLSearchParams(params).toString();
}

/* ── PostgREST ─────────────────────────────────────────────────────────── */

/** SELECT — returns the row array. */
export async function supaSelect(table: string, params: SupaParams): Promise<unknown[]> {
  const res = await fetch(`${REST}/${table}?${qs(params)}`, {
    headers: HDRS,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`supabase ${res.status}: ${await res.text()}`);
  const v: unknown = await res.json();
  return Array.isArray(v) ? v : [];
}

/** SELECT one row (first match) or null. */
export async function supaSelectOne(
  table: string,
  params: SupaParams,
): Promise<Record<string, unknown> | null> {
  const rows = (await supaSelect(table, [...params, ["limit", "1"]])) as Record<
    string,
    unknown
  >[];
  return rows[0] ?? null;
}

/** INSERT one row — returns the created row (Prefer: return=representation). */
export async function supaInsert(
  table: string,
  body: unknown,
): Promise<Record<string, unknown> | null> {
  const res = await fetch(`${REST}/${table}`, {
    method: "POST",
    headers: { ...HDRS, prefer: "return=representation", "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`supabase ${res.status}: ${await res.text()}`);
  const v: unknown = await res.json();
  return Array.isArray(v) ? (v[0] as Record<string, unknown>) ?? null : null;
}

/** PATCH rows matching the filters — returns the updated rows. */
export async function supaUpdate(
  table: string,
  filters: SupaParams,
  body: unknown,
): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${REST}/${table}?${qs(filters)}`, {
    method: "PATCH",
    headers: { ...HDRS, prefer: "return=representation", "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`supabase ${res.status}: ${await res.text()}`);
  const v: unknown = await res.json();
  return Array.isArray(v) ? (v as Record<string, unknown>[]) : [];
}

/** DELETE rows matching the filters. */
export async function supaDelete(table: string, filters: SupaParams): Promise<void> {
  const res = await fetch(`${REST}/${table}?${qs(filters)}`, {
    method: "DELETE",
    headers: HDRS,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`supabase ${res.status}: ${await res.text()}`);
}

/* ── GoTrue (Supabase Auth) — login verification lives in the DB ──────── */

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
};

/** A user as GoTrue returns it: { id, email, user_metadata: { full_name } }. */
export function userFromAuth(row: Record<string, unknown>): AuthUser | null {
  const id = row.id;
  const email = row.email;
  if (typeof id !== "string" || typeof email !== "string") return null;
  const meta = row.user_metadata as Record<string, unknown> | undefined;
  const name = meta && typeof meta.full_name === "string" ? meta.full_name : null;
  return { id, email, name };
}

/**
 * Create an auth user via the admin API. The `handle_new_user` trigger on
 * auth.users makes the profiles row. Error messages look like
 * "gotrue <status>: <body>" (422 = email taken) — callers match on that.
 */
export async function authAdminCreateUser(
  email: string,
  password: string,
  fullName: string,
  emailConfirm = true,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${AUTH}/admin/users`, {
    method: "POST",
    headers: { ...HDRS, "content-type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      email_confirm: emailConfirm,
      user_metadata: { full_name: fullName },
    }),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`gotrue ${res.status}: ${text}`);
  return JSON.parse(text) as Record<string, unknown>;
}

/** Admin fetch — one auth user by id (for e.g. the client's e-mail). */
export async function authAdminGetUser(id: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${AUTH}/admin/users/${id}`, { headers: HDRS, cache: "no-store" });
  const text = await res.text();
  if (!res.ok) throw new Error(`gotrue ${res.status}: ${text}`);
  return JSON.parse(text) as Record<string, unknown>;
}

/** Admin update — e.g. { email_confirm: true } after the verification
 * link is followed, or new user_metadata. Returns the updated user. */
export async function authAdminUpdateUser(
  id: string,
  patch: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${AUTH}/admin/users/${id}`, {
    method: "PUT",
    headers: { ...HDRS, "content-type": "application/json" },
    body: JSON.stringify(patch),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`gotrue ${res.status}: ${text}`);
  return JSON.parse(text) as Record<string, unknown>;
}

/** Password grant — verifies credentials against auth.users. 200 returns
 * { access_token, refresh_token, user }; a 400 with "invalid_grant" means
 * wrong email/password. */
export async function authPasswordLogin(
  email: string,
  password: string,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${AUTH}/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SERVICE_KEY, "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`gotrue ${res.status}: ${text}`);
  return JSON.parse(text) as Record<string, unknown>;
}

/** PKCE code exchange (grant_type=pkce) — completes the OAuth flow that
 * /auth/v1/authorize started: presents auth_code + the code_verifier from
 * the browser cookie. Returns the GoTrue session ({ access_token, user }). */
export async function authPkceExchange(
  authCode: string,
  codeVerifier: string,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${AUTH}/token?grant_type=pkce`, {
    method: "POST",
    headers: { apikey: SERVICE_KEY, "content-type": "application/json" },
    body: JSON.stringify({ auth_code: authCode, code_verifier: codeVerifier }),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`gotrue ${res.status}: ${text}`);
  return JSON.parse(text) as Record<string, unknown>;
}
