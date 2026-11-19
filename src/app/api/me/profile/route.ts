import { NextResponse, type NextRequest } from "next/server";
import { getProfileView, updateProfile, weightHistory, type ProfilePatchIn } from "@/lib/server/profile";
import { currentSession } from "@/lib/server/session";
import { guardConfigured, jsonError, readJson, toErrorResponse } from "@/lib/server/route-helpers";

export const dynamic = "force-dynamic";

/** GET /api/me/profile — the signed-in user's own data (+ weight history). */
export async function GET(req: NextRequest) {
  const blocked = guardConfigured();
  if (blocked) return blocked;
  try {
    const cs = await currentSession(req);
    if (!cs) return jsonError(401, "unauthorized");
    const profile = await getProfileView(cs.user.id);
    const weights = await weightHistory(cs.user.id);
    return NextResponse.json({ profile, weights, email: cs.user.email });
  } catch (e) {
    return toErrorResponse(e);
  }
}

/** PATCH /api/me/profile — edit the signed-in user's own data:
 *  { name?, avatarUrl? (data URL | null), gender?, birthYear?, heightCm?,
 *    weightKg?, goal?, activityLevel?, fitnessLevel?, workoutsPerWeek?,
 *    railFolded?, planOnboardingDone? }. */
export async function PATCH(req: NextRequest) {
  const blocked = guardConfigured();
  if (blocked) return blocked;
  try {
    const cs = await currentSession(req);
    if (!cs) return jsonError(401, "unauthorized");
    const body = (await readJson(req)) as ProfilePatchIn;
    const profile = await updateProfile(cs.user.id, body);
    const weights = await weightHistory(cs.user.id);
    return NextResponse.json({ profile, weights, email: cs.user.email });
  } catch (e) {
    return toErrorResponse(e);
  }
}
