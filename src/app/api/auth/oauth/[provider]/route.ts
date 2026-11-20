import { createHash, randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { authBase, supabaseConfigured } from "@/lib/server/supa";
import { isSecure, oauthCookie, originFrom } from "@/lib/server/session";
import { jsonError } from "@/lib/server/route-helpers";

export const dynamic = "force-dynamic";

/** Minimal encodeURIComponent for the redirect_to query parameter. */
function percentEncode(s: string): string {
  return encodeURIComponent(s);
}

/** SHA-256 then base64url without padding — the S256 code_challenge
 * format GoTrue requires. */
function sha256B64url(s: string): string {
  return createHash("sha256").update(s).digest("base64url");
}

/**
 * GET /api/auth/oauth/{google|apple}?locale — starts the OAuth flow:
 * mints a PKCE verifier (kept with the locale in a short-lived
 * HttpOnly cookie), then redirects to Supabase's /authorize. Provider
 * credentials live in Supabase (Authentication → Providers).
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ provider: string }> },
) {
  if (!supabaseConfigured) return jsonError(503, "supabase_unconfigured");
  const { provider } = await ctx.params;
  if (provider !== "google" && provider !== "apple") {
    return jsonError(404, "unknown_provider");
  }

  const origin = originFrom(req.headers);
  const redirectTo = `${origin}/api/auth/callback`;
  const localeRaw = req.nextUrl.searchParams.get("locale") ?? "az";
  const locale = localeRaw === "en" || localeRaw === "ru" ? localeRaw : "az";

  const verifier = randomBytes(48).toString("base64url"); // 64 chars — inside 43..128
  const challenge = sha256B64url(verifier);

  const url = `${authBase}/authorize?provider=${provider}`
    + `&redirect_to=${percentEncode(redirectTo)}`
    + `&code_challenge=${challenge}&code_challenge_method=S256`;

  const res = NextResponse.redirect(url, 302);
  res.cookies.set(oauthCookie(verifier, isSecure(req.headers), locale));
  return res;
}
