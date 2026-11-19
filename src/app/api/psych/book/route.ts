import { NextResponse, type NextRequest } from "next/server";
import { book, bookCount } from "@/lib/server/psych-data";
import { currentSession } from "@/lib/server/session";
import { guardConfigured, jsonError, readJson, toErrorResponse } from "@/lib/server/route-helpers";

export const dynamic = "force-dynamic";

/** GET /api/psych/book — how many psychologists are bookable. */
export async function GET() {
  const blocked = guardConfigured();
  if (blocked) return blocked;
  try {
    return NextResponse.json(await bookCount());
  } catch (e) {
    return toErrorResponse(e);
  }
}

/** POST /api/psych/book { slug, date, hour, mode } — reserve a slot. */
export async function POST(req: NextRequest) {
  const blocked = guardConfigured();
  if (blocked) return blocked;
  try {
    const cs = await currentSession(req);
    if (!cs) return jsonError(401, "unauthorized");
    const body = await readJson(req);
    const out = await book(cs.user, body);
    return NextResponse.json(out, { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
