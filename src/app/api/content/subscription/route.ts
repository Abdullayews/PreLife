import { NextResponse } from "next/server";
import { subscriptionCatalog } from "@/lib/server/content";
import { guardConfigured, toErrorResponse } from "@/lib/server/route-helpers";

export const dynamic = "force-dynamic";

/** GET /api/content/subscription — priced features + tiers. */
export async function GET() {
  const blocked = guardConfigured();
  if (blocked) return blocked;
  try {
    return NextResponse.json(await subscriptionCatalog());
  } catch (e) {
    return toErrorResponse(e);
  }
}
