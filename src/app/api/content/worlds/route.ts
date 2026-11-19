import { NextResponse } from "next/server";
import { worldsCatalog } from "@/lib/server/content";
import { guardConfigured, toErrorResponse } from "@/lib/server/route-helpers";

export const dynamic = "force-dynamic";

/** GET /api/content/worlds — every world's plans/items/places/schedule. */
export async function GET() {
  const blocked = guardConfigured();
  if (blocked) return blocked;
  try {
    return NextResponse.json(await worldsCatalog());
  } catch (e) {
    return toErrorResponse(e);
  }
}
