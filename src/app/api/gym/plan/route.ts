import { NextResponse, type NextRequest } from "next/server";
import { ensureDefaultPlan, generatePlan, getActivePlan, resetPlans, type PlanAnswers } from "@/lib/server/user-plans";
import { getProfileView, updateProfile } from "@/lib/server/profile";
import { currentSession } from "@/lib/server/session";
import { guardConfigured, jsonError, readJson, toErrorResponse } from "@/lib/server/route-helpers";

export const dynamic = "force-dynamic";

/**
 * GET /api/gym/plan?locale=az — the signed-in user's ACTIVE plan. The
 * default starter plan is created lazily on first read, so the plan tab
 * is never empty. Also returns whether the onboarding questionnaire was
 * already completed.
 */
export async function GET(req: NextRequest) {
  const blocked = guardConfigured();
  if (blocked) return blocked;
  try {
    const cs = await currentSession(req);
    if (!cs) return jsonError(401, "unauthorized");
    const locale = normLocale(req.nextUrl.searchParams.get("locale"));
    const plan = await ensureDefaultPlan(cs.user.id, locale);
    const profile = await getProfileView(cs.user.id);
    return NextResponse.json({ plan, onboardingDone: profile.planOnboardingDone });
  } catch (e) {
    return toErrorResponse(e);
  }
}

/**
 * POST /api/gym/plan { answers, locale } — the questionnaire flow: build
 * a personal plan from the answers (AI, with the deterministic rule-based
 * fallback) and mark the onboarding done.
 */
export async function POST(req: NextRequest) {
  const blocked = guardConfigured();
  if (blocked) return blocked;
  try {
    const cs = await currentSession(req);
    if (!cs) return jsonError(401, "unauthorized");
    const body = await readJson(req);
    const locale = normLocale(typeof body.locale === "string" ? body.locale : null);
    const answers = (body.answers ?? {}) as PlanAnswers;
    if (!answers || typeof answers !== "object" || Object.keys(answers).length === 0) {
      return jsonError(400, "invalid");
    }
    const out = await generatePlan(cs.user.id, answers, locale);
    await updateProfile(cs.user.id, { planOnboardingDone: true }).catch(() => {});
    return NextResponse.json({ ...out, onboardingDone: true });
  } catch (e) {
    return toErrorResponse(e);
  }
}

/** DELETE /api/gym/plan — deactivate every plan (the next GET recreates
 *  the default starter plan; the questionnaire becomes available again). */
export async function DELETE(req: NextRequest) {
  const blocked = guardConfigured();
  if (blocked) return blocked;
  try {
    const cs = await currentSession(req);
    if (!cs) return jsonError(401, "unauthorized");
    await resetPlans(cs.user.id);
    await updateProfile(cs.user.id, { planOnboardingDone: false }).catch(() => {});
    return NextResponse.json({ ok: true, plan: await getActivePlan(cs.user.id) });
  } catch (e) {
    return toErrorResponse(e);
  }
}

function normLocale(v: string | null): string {
  return v === "en" ? "en" : v === "ru" ? "ru" : "az";
}
