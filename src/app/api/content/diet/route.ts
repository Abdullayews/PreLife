import { NextResponse } from "next/server";
import { dietCatalog } from "@/lib/server/content";
import { guardConfigured, toErrorResponse } from "@/lib/server/route-helpers";

export const dynamic = "force-dynamic";

/** GET /api/content/diet — diet world: plans, recipes, places, details. */
export async function GET() {
  const blocked = guardConfigured();
  if (blocked) return blocked;
  try {
    return NextResponse.json(await dietCatalog());
  } catch (e) {
    return toErrorResponse(e);
  }
}
