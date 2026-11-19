import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfigured } from "@/lib/server/supa";

export const dynamic = "force-dynamic";

const STARTED_AT = Date.now();
const VERSION = "2.1.0";

/** GET /api/health — liveness + Supabase configuration report. */
export function GET() {
  return NextResponse.json({
    ok: true,
    service: "prelife",
    version: VERSION,
    uptimeSecs: Math.floor((Date.now() - STARTED_AT) / 1000),
    supabaseConfigured,
  });
}
