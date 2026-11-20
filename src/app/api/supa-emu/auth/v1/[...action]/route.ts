import { createHash, randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import {
  emuData, emuEnabled, emuHashPassword, emuTouch, emuVerifyPassword, gotrueUser, type Row,
} from "@/lib/server/emu/store";

/**
 * The local GoTrue emulator — the auth surface Supabase serves at
 * /auth/v1, implemented in-process for the sandbox (SUPABASE_EMU=1):
 *
 *   POST /api/supa-emu/auth/v1/admin/users           — admin create user
 *   PUT  /api/supa-emu/auth/v1/admin/users/{id}      — admin update user
 *   POST /api/supa-emu/auth/v1/token?grant_type=password — password grant
 *   POST /api/supa-emu/auth/v1/token?grant_type=pkce — OAuth code exchange
 *   GET  /api/supa-emu/auth/v1/authorize             — provider consent page
 *   POST /api/supa-emu/auth/v1/authorize             — consent submit → code
 *
 * Error contracts match GoTrue: a taken e-mail answers 422, wrong
 * credentials and unconfirmed e-mails answer 400 invalid_grant (the
 * backend matches on the body text). Creating a user also creates the
 * profiles row — the handle_new_user trigger, emulated.
 *
 * The OAuth surface replaces the real provider window: /authorize
 * shows a consent page where the "Google/Apple identity" (any e-mail)
 * is chosen, then bounces to the app's /api/auth/callback with a
 * single-use code bound to the PKCE challenge — exactly the shape the
 * real dance produces, so the v4.4 signup/login rules are fully
 * testable in the sandbox.
 */

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ action: string[] }> };

function guard(): NextResponse | null {
  return emuEnabled() ? null : NextResponse.json({ message: "not found" }, { status: 404 });
}

function err(status: number, body: Row): NextResponse {
  return NextResponse.json(body, { status });
}

/* ── OAuth dance state (memory only — a restart mid-dance just fails it) ── */

type OAuthCode = { challenge: string; userId: string; expires: number };
const OG = globalThis as unknown as { __prelifeEmuOauth?: Map<string, OAuthCode> };
const oauthCodes: Map<string, OAuthCode> = (OG.__prelifeEmuOauth ??= new Map());

const OAUTH_CODE_TTL_MS = 10 * 60 * 1000;

/** The sandbox identities the consent page offers per provider. */
const EMU_IDENTITY: Record<string, { email: string; name: string }> = {
  google: { email: "google.user@emu.prelife.dev", name: "Google User" },
  apple: { email: "apple.user@emu.prelife.dev", name: "Apple User" },
};

function sha256B64url(s: string): string {
  return createHash("sha256").update(s).digest("base64url");
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ?? c;
  });
}

/** Find-or-link-or-create the auth user behind a provider consent:
 * an existing e-mail gets the provider linked onto its app_metadata
 * (GoTrue does the same); an unknown one becomes a fresh, confirmed,
 * provider-only account — the row shape the v4.4 callback rules read. */
function oauthUpsertUser(provider: string, email: string): Row {
  const data = emuData();
  const now = new Date().toISOString();
  const existing = data.authUsers.find((u) => u.email === email);

  if (existing) {
    const meta = existing.app_metadata && typeof existing.app_metadata === "object"
      ? { ...(existing.app_metadata as Row) }
      : { provider: "email", providers: ["email"] };
    const providers = Array.isArray(meta.providers) ? meta.providers.map(String) : [];
    if (!providers.includes(provider)) providers.push(provider);
    meta.providers = providers;
    meta.provider = provider;
    existing.app_metadata = meta;
    existing.updated_at = now;
    emuTouch();
    return existing;
  }

  const user: Row = {
    id: randomUUID(),
    email,
    pass_hash: emuHashPassword(randomUUID()), // nobody knows it — provider-only
    email_confirmed: true, // the provider vouches for the e-mail
    user_metadata: { full_name: EMU_IDENTITY[provider]?.name ?? "OAuth User" },
    app_metadata: { provider, providers: [provider] },
    created_at: now, updated_at: now, last_sign_in_at: null,
  };
  data.authUsers.push(user);

  // handle_new_user trigger: the profiles row
  const fullName = (user.user_metadata as Row).full_name ?? null;
  (data.tables.profiles ??= []).push({
    id: user.id, full_name: fullName, username: null,
    avatar_url: null, lang: "en", theme: "light", rail_folded: false,
    plan_onboarding_done: false, fitness_level: null, workouts_per_week: null,
    reading_goal_books_per_year: null, gender: null, birth_year: null,
    height_cm: null, goal: null, activity_level: null,
    created_at: now, updated_at: now,
  });
  emuTouch();
  return user;
}

/** Mint a single-use auth code bound to the PKCE challenge. */
function issueOauthCode(challenge: string, userId: string): string {
  const now = Date.now();
  for (const [k, v] of oauthCodes) {
    if (v.expires <= now) oauthCodes.delete(k);
  }
  const code = `emu-oauth-${randomUUID()}`;
  oauthCodes.set(code, { challenge, userId, expires: now + OAUTH_CODE_TTL_MS });
  return code;
}

/** The consent page — the emulator's stand-in for Google/Apple's window. */
function consentPage(provider: string, redirectTo: string, challenge: string, method: string): NextResponse {
  const identity = EMU_IDENTITY[provider] ?? { email: "", name: "OAuth User" };
  const title = provider === "apple" ? "Apple" : "Google";
  const html = `<!doctype html>
<html lang="az">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} hesabı — emulyator</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: grid; place-items: center;
    font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
    background: #f4f2ee; color: #1f1d1a; padding: 24px;
  }
  .card {
    width: min(400px, 100%); background: #fff; border: 1px solid #e4e0d8;
    border-radius: 16px; padding: 28px; box-shadow: 0 12px 40px rgba(31,29,26,.08);
  }
  .brand { margin: 0 0 6px; font-weight: 700; font-size: 18px; letter-spacing: .2px; }
  .brand em { font-style: normal; color: #b08d2f; }
  .tag { margin: 0 0 18px; font-size: 12px; color: #8a857c; text-transform: uppercase; letter-spacing: .8px; }
  h1 { margin: 0 0 8px; font-size: 21px; }
  p.note { margin: 0 0 20px; font-size: 13.5px; color: #6f6a61; }
  label { display: block; margin-bottom: 6px; font-size: 13px; font-weight: 600; }
  input[type=email] {
    width: 100%; padding: 11px 12px; border: 1px solid #d8d3c9; border-radius: 10px;
    font-size: 15px; background: #fbfaf8; color: inherit;
  }
  input[type=email]:focus { outline: 2px solid #b08d2f; outline-offset: -1px; }
  button {
    margin-top: 18px; width: 100%; padding: 12px 16px; border: 0; border-radius: 10px;
    background: #1f1d1a; color: #fff; font-size: 15px; font-weight: 600; cursor: pointer;
  }
  button:hover { background: #38342e; }
  .hint { margin: 14px 0 0; font-size: 12.5px; color: #8a857c; }
</style>
</head>
<body>
<main class="card">
  <p class="brand">Pre<em>Life</em></p>
  <p class="tag">Sandbox emulyatoru</p>
  <h1>${title} hesabı ilə davam edin</h1>
  <p class="note">Bu səhifə yalnız sınaq rejimində görünür — real ${title} pəncərəsinin yerini tutur. Mövcud hesabın e-poçtunu yazsanız, provayder ona bağlanacaq.</p>
  <form method="post" action="/api/supa-emu/auth/v1/authorize">
    <input type="hidden" name="provider" value="${escapeHtml(provider)}">
    <input type="hidden" name="redirect_to" value="${escapeHtml(redirectTo)}">
    <input type="hidden" name="code_challenge" value="${escapeHtml(challenge)}">
    <input type="hidden" name="code_challenge_method" value="${escapeHtml(method)}">
    <label for="email">${title} e-poçtu</label>
    <input id="email" name="email" type="email" value="${escapeHtml(identity.email)}" required autocomplete="off">
    <button type="submit">Davam et</button>
    <p class="hint">Qeydiyyatda basanda hesab dərhal yaranır; girişdə basanda e-poçt yoxdursa mail axınına keçirsiniz.</p>
  </form>
</main>
</body>
</html>`;
  return new NextResponse(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}

/* ── POST ────────────────────────────────────────────────────────────────── */
export async function POST(req: NextRequest, ctx: Ctx): Promise<NextResponse> {
  const blocked = guard();
  if (blocked) return blocked;
  const { action } = await ctx.params;

  /* POST /authorize — the consent submit. Finds-or-creates the provider
   * user, mints the single-use code and bounces to the app's callback,
   * exactly where the real provider window would send the browser. */
  if (action.length === 1 && action[0] === "authorize") {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return err(400, { message: "invalid form" });
    }
    const provider = String(form.get("provider") ?? "");
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const redirectTo = String(form.get("redirect_to") ?? "");
    const challenge = String(form.get("code_challenge") ?? "");
    const method = String(form.get("code_challenge_method") ?? "S256");

    if (provider !== "google" && provider !== "apple") {
      return err(400, { message: "unknown provider" });
    }
    if (!email.includes("@") || email.length > 120) {
      return err(400, { message: "invalid email" });
    }
    if (!challenge || method !== "S256") {
      return err(400, { message: "invalid code_challenge" });
    }
    // Only our own callback — never an arbitrary redirect target.
    let target: URL;
    try {
      target = new URL(redirectTo);
    } catch {
      return err(400, { message: "invalid redirect_to" });
    }
    if (target.pathname !== "/api/auth/callback") {
      return err(400, { message: "invalid redirect_to" });
    }

    const user = oauthUpsertUser(provider, email);
    const code = issueOauthCode(challenge, String(user.id));
    target.searchParams.set("code", code);
    return NextResponse.redirect(target, 302);
  }

  /* /admin/users — create */
  if (action.length === 2 && action[0] === "admin" && action[1] === "users") {
    let body: Row;
    try {
      body = (await req.json()) as Row;
    } catch {
      return err(400, { message: "invalid json" });
    }
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const meta = (body.user_metadata && typeof body.user_metadata === "object"
      ? body.user_metadata as Row : {}) as Row;
    const fullName = typeof meta.full_name === "string" ? meta.full_name : "";
    if (!email || !password) return err(400, { message: "email and password required" });

    const data = emuData();
    if (data.authUsers.some((u) => u.email === email)) {
      return err(422, { code: 422, msg: "A user with this email address has already been registered" });
    }

    const now = new Date().toISOString();
    const user: Row = {
      id: crypto.randomUUID(),
      email,
      pass_hash: emuHashPassword(password),
      email_confirmed: body.email_confirm === true,
      // v4.3: keep the whole metadata object (needs_completion etc.),
      // exactly like GoTrue does.
      user_metadata: { ...meta, full_name: fullName },
      created_at: now, updated_at: now, last_sign_in_at: null,
    };
    data.authUsers.push(user);

    // handle_new_user trigger: the profiles row
    (data.tables.profiles ??= []).push({
      id: user.id, full_name: fullName || null, username: null, avatar_url: null,
      lang: "en", theme: "light", rail_folded: false, plan_onboarding_done: false,
      fitness_level: null, workouts_per_week: null, reading_goal_books_per_year: null,
      gender: null, birth_year: null, height_cm: null, goal: null, activity_level: null,
      created_at: now, updated_at: now,
    });
    emuTouch();
    return NextResponse.json(gotrueUser(user), { status: 200 });
  }

  /* /token?grant_type=… — password grant + the OAuth PKCE exchange */
  if (action.length === 1 && action[0] === "token") {
    const grant = req.nextUrl.searchParams.get("grant_type") ?? "";

    /* grant_type=pkce — the callback presents the auth_code from the
     * consent dance plus its PKCE verifier; the verifier must hash to
     * the challenge the dance started with. Single use, 10 minutes. */
    if (grant === "pkce") {
      let body: Row;
      try {
        body = (await req.json()) as Row;
      } catch {
        return err(400, { message: "invalid json" });
      }
      const authCode = typeof body.auth_code === "string" ? body.auth_code : "";
      const verifier = typeof body.code_verifier === "string" ? body.code_verifier : "";
      const entry = oauthCodes.get(authCode);
      if (!entry || entry.expires <= Date.now()) {
        oauthCodes.delete(authCode);
        return err(400, { error: "invalid_grant", error_description: "Invalid auth code" });
      }
      if (!verifier || sha256B64url(verifier) !== entry.challenge) {
        return err(400, { error: "invalid_grant", error_description: "Invalid code_verifier" });
      }
      oauthCodes.delete(authCode); // single use

      const data = emuData();
      const user = data.authUsers.find((u) => u.id === entry.userId);
      if (!user) {
        return err(400, { error: "invalid_grant", error_description: "User not found" });
      }
      user.last_sign_in_at = new Date().toISOString();
      emuTouch();
      return NextResponse.json({
        access_token: `emu-${randomUUID()}`,
        token_type: "bearer",
        expires_in: 3600,
        refresh_token: `emu-refresh-${randomUUID()}`,
        user: gotrueUser(user),
      });
    }

    if (grant !== "password") {
      return err(400, { error: "unsupported_grant_type", error_description: `Unsupported grant_type: ${grant}` });
    }
    let body: Row;
    try {
      body = (await req.json()) as Row;
    } catch {
      return err(400, { message: "invalid json" });
    }
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const data = emuData();
    const user = data.authUsers.find((u) => u.email === email);
    if (!user || !emuVerifyPassword(password, user.pass_hash)) {
      return err(400, { error: "invalid_grant", error_description: "Invalid login credentials" });
    }
    if (user.email_confirmed !== true) {
      return err(400, { error: "invalid_grant", error_description: "Email not confirmed" });
    }
    user.last_sign_in_at = new Date().toISOString();
    emuTouch();
    return NextResponse.json({
      access_token: `emu-${crypto.randomUUID()}`,
      token_type: "bearer",
      expires_in: 3600,
      refresh_token: `emu-refresh-${crypto.randomUUID()}`,
      user: gotrueUser(user),
    });
  }

  return err(404, { message: "not found" });
}

/* ── GET ─────────────────────────────────────────────────────────────────── */

export async function GET(req: NextRequest, ctx: Ctx): Promise<NextResponse> {
  const blocked = guard();
  if (blocked) return blocked;
  const { action } = await ctx.params;

  /* GET /admin/users?emails=a@b.c — the exact-match e-mail lookup the
   * login route uses (mirrors GoTrue's admin list endpoint shape). */
  if (action.length === 2 && action[0] === "admin" && action[1] === "users") {
    const sp = req.nextUrl.searchParams;
    const emails = sp
      .getAll("emails")
      .flatMap((v) => v.split(","))
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const filter = (sp.get("filter") ?? "").trim().toLowerCase();

    const data = emuData();
    let users = data.authUsers;
    if (emails.length) {
      users = users.filter((u) => emails.includes(String(u.email).toLowerCase()));
    } else if (filter) {
      users = users.filter((u) => String(u.email).toLowerCase().includes(filter));
    }

    const perPage = Math.max(1, Math.min(50, Number(sp.get("per_page") ?? 10) || 10));
    const page = Math.max(1, Number(sp.get("page") ?? 1) || 1);
    const start = (page - 1) * perPage;
    return NextResponse.json({
      users: users.slice(start, start + perPage).map((u) => gotrueUser(u)),
      total: users.length,
      page,
      per_page: perPage,
    });
  }

  /* GET /admin/users/{id} — one user (the verify route reads its
   * user_metadata for the needs_completion flag). */
  if (action.length === 3 && action[0] === "admin" && action[1] === "users") {
    const data = emuData();
    const user = data.authUsers.find((u) => u.id === action[2]);
    if (!user) return err(404, { code: 404, msg: "User not found" });
    return NextResponse.json(gotrueUser(user));
  }

  /* GET /authorize — the provider consent page (the emulator's
   * stand-in for the real Google/Apple window; DEV sandbox only). */
  if (action.length === 1 && action[0] === "authorize") {
    const sp = req.nextUrl.searchParams;
    const provider = sp.get("provider") ?? "";
    if (provider !== "google" && provider !== "apple") {
      return err(400, { message: "unknown provider" });
    }
    const redirectTo = sp.get("redirect_to") ?? "";
    const challenge = sp.get("code_challenge") ?? "";
    const method = sp.get("code_challenge_method") ?? "S256";
    if (!redirectTo || !challenge || method !== "S256") {
      return err(400, { message: "invalid authorize request" });
    }
    return consentPage(provider, redirectTo, challenge, method);
  }

  return err(404, { message: "not found" });
}

/* ── DELETE ─────────────────────────────────────────────────────────────── */

export async function DELETE(_req: NextRequest, ctx: Ctx): Promise<NextResponse> {
  const blocked = guard();
  if (blocked) return blocked;
  const { action } = await ctx.params;

  /* DELETE /admin/users/{id} — mirrors GoTrue; cascades the profiles,
   * sessions and verification rows like the real FK constraints do. */
  if (action.length === 3 && action[0] === "admin" && action[1] === "users") {
    const id = action[2]!;
    const data = emuData();
    const idx = data.authUsers.findIndex((u) => u.id === id);
    if (idx === -1) return err(404, { code: 404, msg: "User not found" });

    data.authUsers.splice(idx, 1);
    for (const table of ["profiles", "sessions", "email_verifications"]) {
      data.tables[table] = (data.tables[table] ?? []).filter(
        (row) => row.user_id !== id && row.id !== id,
      );
    }
    emuTouch();
    return NextResponse.json({ message: "User deleted successfully" });
  }

  return err(404, { message: "not found" });
}

/* ── PUT ─────────────────────────────────────────────────────────────────── */
export async function PUT(req: NextRequest, ctx: Ctx): Promise<NextResponse> {
  const blocked = guard();
  if (blocked) return blocked;
  const { action } = await ctx.params;

  /* /admin/users/{id} — update (email_confirm, user_metadata, password…) */
  if (action.length === 3 && action[0] === "admin" && action[1] === "users") {
    const id = action[2]!;
    let body: Row;
    try {
      body = (await req.json()) as Row;
    } catch {
      return err(400, { message: "invalid json" });
    }
    const data = emuData();
    const user = data.authUsers.find((u) => u.id === id);
    if (!user) return err(404, { code: 404, msg: "User not found" });

    if (typeof body.email_confirm === "boolean") user.email_confirmed = body.email_confirm;
    if (typeof body.password === "string" && body.password) user.pass_hash = emuHashPassword(body.password);
    if (body.user_metadata && typeof body.user_metadata === "object") {
      user.user_metadata = { ...(user.user_metadata as Row), ...(body.user_metadata as Row) };
      const fullName = (user.user_metadata as Row).full_name;
      if (typeof fullName === "string") {
        const profile = (data.tables.profiles ?? []).find((p) => p.id === id);
        if (profile) profile.full_name = fullName;
      }
    }
    user.updated_at = new Date().toISOString();
    emuTouch();
    return NextResponse.json(gotrueUser(user));
  }

  return err(404, { message: "not found" });
}
