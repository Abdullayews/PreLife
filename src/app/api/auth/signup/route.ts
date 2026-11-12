import { NextResponse } from "next/server";
import { createSessionToken, hashPassword, SESSION_COOKIE, SESSION_TTL_S } from "@/lib/auth";
import { db } from "@/lib/db";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** POST /api/auth/signup — { name, email, password } → account + session cookie. */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { name?: unknown; email?: unknown; password?: unknown };
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!name || !email || !password) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "invalid_email" }, { status: 400 });
    }
    if (password.length < 4) {
      return NextResponse.json({ error: "short_password" }, { status: 400 });
    }

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "email_taken" }, { status: 409 });
    }

    const user = await db.user.create({
      data: { email, name, passwordHash: hashPassword(password) },
    });

    const res = NextResponse.json({ user: { id: user.id, email: user.email, name: user.name } });
    res.cookies.set(SESSION_COOKIE, createSessionToken(user.id), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL_S,
      secure: process.env.NODE_ENV === "production",
    });
    return res;
  } catch (err) {
    console.error("[signup]", err);
    return NextResponse.json({ error: "generic" }, { status: 500 });
  }
}
