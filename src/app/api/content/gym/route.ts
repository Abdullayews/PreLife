import { NextResponse } from "next/server";
import { gymCatalog } from "@/lib/server/content";
import { guardConfigured, toErrorResponse } from "@/lib/server/route-helpers";

export const dynamic = "force-dynamic";

/** GET /api/content/gym — gym world: places, stores, catalog, workouts. */
export async function GET() {
  const blocked = guardConfigured();
  if (blocked) return blocked;
  try {
    return NextResponse.json(await gymCatalog());
  } catch (e) {
    return toErrorResponse(e);
  }
}
