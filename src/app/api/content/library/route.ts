import { NextResponse } from "next/server";
import { libraryCatalog } from "@/lib/server/content";
import { guardConfigured, toErrorResponse } from "@/lib/server/route-helpers";

export const dynamic = "force-dynamic";

/** GET /api/content/library — library world: collections, books, places. */
export async function GET() {
  const blocked = guardConfigured();
  if (blocked) return blocked;
  try {
    return NextResponse.json(await libraryCatalog());
  } catch (e) {
    return toErrorResponse(e);
  }
}
