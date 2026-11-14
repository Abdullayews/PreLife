import { NextResponse } from "next/server";
import { createSession, ensureDemoAccount, SESSION_COOKIE, SESSION_TTL_S, verifyPassword } from "@/lib/auth";
import { db } from "@/lib/db";

/** POST /api/auth/login — { email, password } → session cookie + user. */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { email?: unknown; password?: unknown };
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !password) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }

    // The static demo account (123/123) is created on first use.
    await ensureDemoAccount();

    const user = await db.user.findUnique({ where: { email } });
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
    }

    const res = NextResponse.json({ user: { id: user.id, email: user.email, name: user.name } });
    // One Session row per device (visible + manageable in Settings → Devices).
    const token = await createSession(user.id, req.headers.get("user-agent"));
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL_S,
      secure: process.env.NODE_ENV === "production",
    });
    return res;
  } catch (err) {
    console.error("[login]", err);
    return NextResponse.json({ error: "generic" }, { status: 500 });
  }
}
