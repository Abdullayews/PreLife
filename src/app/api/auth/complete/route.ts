import { NextResponse, type NextRequest } from "next/server";
import { authAdminUpdateUser, supaUpdate } from "@/lib/server/supa";
import { sessionCacheDropUser } from "@/lib/server/session";
import { getSessionUser } from "@/lib/auth";
import { jsonError, readJson } from "@/lib/server/route-helpers";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/complete { name, password } — the finishing step of the
 * login-page "e-mail only" registration. Those accounts are activated by
 * the verification link but hold a random placeholder password; this
 * endpoint (session-guarded — the verify link just minted one) writes
 * the visitor's chosen name + password onto the account.
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return jsonError(401, "unauthorized");

  const body = await readJson(req);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if ([...name].length < 2) return jsonError(400, "missing_fields");
  if ([...password].length < 8) return jsonError(400, "short_password");

  try {
    // Real GoTrue replaces user_metadata on update; the emulator merges —
    // passing the full object (needs_completion: false) is correct on both.
    await authAdminUpdateUser(user.id, {
      password,
      user_metadata: { full_name: name, needs_completion: false },
    });
  } catch (e) {
    console.error("[auth:complete user]", e);
    return jsonError(500, "generic");
  }

  // Keep the profiles row in sync (the trigger wrote the empty name),
  // drop the session cache and mirror the name onto the session rows —
  // same dance updateProfile does — so the very next render greets with
  // the chosen name instead of the empty snapshot from the verify link.
  await supaUpdate("profiles", [["id", `eq.${user.id}`]], { full_name: name }).catch(() => {});
  sessionCacheDropUser(user.id);
  await supaUpdate(
    "sessions",
    [["user_id", `eq.${user.id}`]],
    { user_name: name },
  ).catch(() => {});

  return NextResponse.json({ ok: true });
}
