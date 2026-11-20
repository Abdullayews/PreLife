import { headers } from "next/headers";

/**
 * The server-side data layer's transport — every SSR getter talks to the
 * Rust backend (mini-services/prelife-api) over a direct local call
 * (API_INTERNAL_URL, default :3030) with the visitor's cookie forwarded,
 * so the session, the rate limits and the caches all live in ONE backend
 * process. No gateway hop, no XTransformPort (server-to-server).
 */
const BASE = process.env.API_INTERNAL_URL ?? "http://127.0.0.1:3030";

/** GET a backend path with the request's cookie; null on any failure. */
export async function apiGet<T>(path: string): Promise<T | null> {
  try {
    const h = await headers();
    const cookie = h.get("cookie");
    const res = await fetch(`${BASE}${path}`, {
      cache: "no-store",
      headers: cookie ? { cookie } : undefined,
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
