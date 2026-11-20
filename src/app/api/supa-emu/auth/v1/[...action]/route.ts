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
 *
 * Error contracts match GoTrue: a taken e-mail answers 422, wrong
 * credentials and unconfirmed e-mails answer 400 invalid_grant (the
 * backend matches on the body text). Creating a user also creates the
 * profiles row — the handle_new_user trigger, emulated.
 */

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ action: string[] }> };

function guard(): NextResponse | null {
  return emuEnabled() ? null : NextResponse.json({ message: "not found" }, { status: 404 });
}

function err(status: number, body: Row): NextResponse {
  return NextResponse.json(body, { status });
}

/* ── POST ────────────────────────────────────────────────────────────────── */
export async function POST(req: NextRequest, ctx: Ctx): Promise<NextResponse> {
  const blocked = guard();
  if (blocked) return blocked;
  const { action } = await ctx.params;

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

  /* /token?grant_type=… — password grant */
  if (action.length === 1 && action[0] === "token") {
    const grant = req.nextUrl.searchParams.get("grant_type") ?? "";
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

  /* GET /authorize — no OAuth providers exist in the sandbox; bounce to
   * the login page with the same error shape the real callback uses. */
  if (action.length === 1 && action[0] === "authorize") {
    return NextResponse.redirect(new URL("/az/login?error=oauth", req.nextUrl.origin), 303);
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
