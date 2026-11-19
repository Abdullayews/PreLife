import { NextResponse } from "next/server";
import { meditationCatalog } from "@/lib/server/content";
import { guardConfigured, toErrorResponse } from "@/lib/server/route-helpers";

export const dynamic = "force-dynamic";

/** GET /api/content/meditation — meditation world + psychologists + media. */
export async function GET() {
  const blocked = guardConfigured();
  if (blocked) return blocked;
  try {
    return NextResponse.json(await meditationCatalog());
  } catch (e) {
    return toErrorResponse(e);
  }
}
