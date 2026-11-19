import { NextResponse, type NextRequest } from "next/server";
import { bookingsList } from "@/lib/server/psych-data";
import { currentSession } from "@/lib/server/session";
import { guardConfigured, jsonError, toErrorResponse } from "@/lib/server/route-helpers";

export const dynamic = "force-dynamic";

/** GET /api/psych/bookings — the user's appointments (newest first). */
export async function GET(req: NextRequest) {
  const blocked = guardConfigured();
  if (blocked) return blocked;
  try {
    const cs = await currentSession(req);
    if (!cs) return jsonError(401, "unauthorized");
    return NextResponse.json(await bookingsList(cs.user));
  } catch (e) {
    return toErrorResponse(e);
  }
}
