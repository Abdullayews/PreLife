import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

/** GET /api/auth/me — the signed-in user (or null). */
export async function GET() {
  const user = await getSessionUser();
  return NextResponse.json({ user });
}
