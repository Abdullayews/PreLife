import { NextResponse, type NextRequest } from "next/server";
import { journalCreate, journalList } from "@/lib/server/psych-data";
import { currentSession } from "@/lib/server/session";
import { guardConfigured, jsonError, readJson, toErrorResponse } from "@/lib/server/route-helpers";

export const dynamic = "force-dynamic";

/** GET /api/psych/journal — the user's journal entries + mood history. */
export async function GET(req: NextRequest) {
  const blocked = guardConfigured();
  if (blocked) return blocked;
  try {
    const cs = await currentSession(req);
    if (!cs) return jsonError(401, "unauthorized");
    return NextResponse.json(await journalList(cs.user));
  } catch (e) {
    return toErrorResponse(e);
  }
}

/** POST /api/psych/journal { content, promptKey? } — create an entry. */
export async function POST(req: NextRequest) {
  const blocked = guardConfigured();
  if (blocked) return blocked;
  try {
    const cs = await currentSession(req);
    if (!cs) return jsonError(401, "unauthorized");
    const body = await readJson(req);
    const out = await journalCreate(cs.user, body);
    return NextResponse.json(out, { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
