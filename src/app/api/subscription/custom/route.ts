import { NextResponse, type NextRequest } from "next/server";
import { createCustomPackage, listCustomPackages } from "@/lib/server/packages";
import { currentSession } from "@/lib/server/session";
import { guardConfigured, jsonError, readJson, toErrorResponse } from "@/lib/server/route-helpers";

export const dynamic = "force-dynamic";

/** GET /api/subscription/custom — my custom-package requests (newest first). */
export async function GET(req: NextRequest) {
  const blocked = guardConfigured();
  if (blocked) return blocked;
  try {
    const cs = await currentSession(req);
    if (!cs) return jsonError(401, "unauthorized");
    return NextResponse.json({ packages: await listCustomPackages(cs.user.id) });
  } catch (e) {
    return toErrorResponse(e);
  }
}

/** POST /api/subscription/custom { features: string[], months: 1|3|6|12 } —
 *  quote + create a custom package request (price computed server-side). */
export async function POST(req: NextRequest) {
  const blocked = guardConfigured();
  if (blocked) return blocked;
  try {
    const cs = await currentSession(req);
    if (!cs) return jsonError(401, "unauthorized");
    const body = await readJson(req);
    const pkg = await createCustomPackage(cs.user.id, body.features, body.months);
    return NextResponse.json({ package: pkg }, { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
