import { NextResponse } from "next/server";
import { ApiCode } from "./psych-data";
import { supabaseConfigured } from "./supa";

/**
 * Shared route-handler plumbing for the merged API: the degraded-mode
 * guard, JSON error building and ApiCode translation — the Next.js port
 * of the Rust require_configured middleware + ApiError.
 */

export function jsonError(status: number, code: string): NextResponse {
  return NextResponse.json({ error: code }, { status });
}

/** 503 `supabase_unconfigured` when the DB env is missing, else null. */
export function guardConfigured(): NextResponse | null {
  return supabaseConfigured ? null : jsonError(503, "supabase_unconfigured");
}

/** Turn a thrown value into the { error: code } JSON response. */
export function toErrorResponse(e: unknown): NextResponse {
  if (e instanceof ApiCode) return jsonError(e.status, e.code);
  console.error("[api] unexpected error:", e);
  return jsonError(500, "generic");
}

/** Parse a JSON request body into a plain object ({} on any parse error). */
export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const v: unknown = await req.json();
    return v && typeof v === "object" && !Array.isArray(v)
      ? (v as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}
