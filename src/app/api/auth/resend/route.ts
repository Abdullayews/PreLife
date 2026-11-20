import { NextResponse, type NextRequest } from "next/server";
import { supaSelectOne, supabaseConfigured } from "@/lib/server/supa";
import { originFrom } from "@/lib/server/session";
import { clientIp, mailSendAllowed } from "@/lib/server/rate-limit";
import { createVerification } from "@/lib/server/verification";
import { jsonError, readJson } from "@/lib/server/route-helpers";

export const dynamic = "force-dynamic";

/** POST /api/auth/resend { email, locale } — rotates the verification
 * token of a pending (unconsumed, unexpired) signup and re-sends the
 * e-mail. Unknown addresses answer 404 "unknown" so the UI can say
 * there is no pending registration. v4.7: the shared mail guard runs
 * before the lookup — this unauthenticated endpoint used to be an
 * unlimited mail-bombing surface (5/hour per address, 20/hour per IP). */
export async function POST(req: NextRequest) {
  if (!supabaseConfigured) return jsonError(503, "supabase_unconfigured");
  const body = await readJson(req);
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const locale = typeof body.locale === "string" ? body.locale : "az";
  if (!email) return jsonError(400, "missing_fields");

  if (!mailSendAllowed(clientIp(req.headers), email)) {
    return jsonError(429, "too_many_requests");
  }

  let pending: Record<string, unknown> | null;
  try {
    pending = await supaSelectOne("email_verifications", [
      ["email", `eq.${email}`],
      ["consumed_at", "is.null"],
      ["expires_at", `gt.${new Date().toISOString()}`],
      ["order", "created_at.desc"],
    ]);
  } catch (e) {
    console.error("[auth:resend lookup]", e);
    return jsonError(500, "generic");
  }

  const userId = pending && typeof pending.user_id === "string" ? pending.user_id : "";
  if (!userId) return jsonError(404, "unknown");

  try {
    const { devLink } = await createVerification(userId, email, locale, originFrom(req.headers));
    return NextResponse.json({ ok: true, devLink });
  } catch (e) {
    console.error("[auth:resend]", e);
    return jsonError(500, "generic");
  }
}
