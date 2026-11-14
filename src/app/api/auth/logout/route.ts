import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { revokeSessionByToken, SESSION_COOKIE } from "@/lib/auth";

/** POST /api/auth/logout — revokes the current device's session row and
 *  clears the cookie. Other devices stay signed in. */
export async function POST() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await revokeSessionByToken(token).catch(() => {});
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}
