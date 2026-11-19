import { NextResponse, type NextRequest } from "next/server";
import { journalDelete } from "@/lib/server/psych-data";
import { currentSession } from "@/lib/server/session";
import { guardConfigured, jsonError, toErrorResponse } from "@/lib/server/route-helpers";

export const dynamic = "force-dynamic";

/** DELETE /api/psych/journal/{id} — remove one of the user's entries. */
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const blocked = guardConfigured();
  if (blocked) return blocked;
  try {
    const cs = await currentSession(req);
    if (!cs) return jsonError(401, "unauthorized");
    const { id } = await ctx.params;
    return NextResponse.json(await journalDelete(cs.user, id));
  } catch (e) {
    return toErrorResponse(e);
  }
}
