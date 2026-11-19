import { NextResponse, type NextRequest } from "next/server";
import { quizSubmit } from "@/lib/server/psych-data";
import { currentSession } from "@/lib/server/session";
import { guardConfigured, jsonError, readJson, toErrorResponse } from "@/lib/server/route-helpers";

export const dynamic = "force-dynamic";

/** POST /api/psych/quiz { quizId, answers } — score and store a quiz. */
export async function POST(req: NextRequest) {
  const blocked = guardConfigured();
  if (blocked) return blocked;
  try {
    const cs = await currentSession(req);
    if (!cs) return jsonError(401, "unauthorized");
    const body = await readJson(req);
    const out = await quizSubmit(cs.user, body);
    return NextResponse.json(out, { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
