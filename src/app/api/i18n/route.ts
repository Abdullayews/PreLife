import { NextResponse, type NextRequest } from "next/server";
import { i18nCatalog } from "@/lib/server/content";
import { guardConfigured, toErrorResponse } from "@/lib/server/route-helpers";

export const dynamic = "force-dynamic";

/** GET /api/i18n?locale=az|en|ru — the DB message catalog as nested JSON. */
export async function GET(req: NextRequest) {
  const blocked = guardConfigured();
  if (blocked) return blocked;
  try {
    const locale = req.nextUrl.searchParams.get("locale") ?? "az";
    const catalog = await i18nCatalog(locale);
    return NextResponse.json(catalog);
  } catch (e) {
    return toErrorResponse(e);
  }
}
