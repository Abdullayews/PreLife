import { NextRequest, NextResponse } from "next/server";

/**
 * Single-origin /api/* reverse proxy → the Rust backend (prelife-api).
 *
 * Why this exists: ALL browser code fetches relative `/api/...` URLs
 * (`src/lib/api-url.ts`). In the sandbox the gateway routes those requests
 * to the Rust service via `?XTransformPort=3031` and Next never sees them.
 * On Render there is no gateway — the request lands on the Next server,
 * which (being UI-only since the Rust migration) has no API routes of its
 * own. This catch-all forwards everything to `PRELIFE_API_URL`, so any
 * single-origin deployment (Render, Docker, bare metal) works out of the
 * box. An outer reverse proxy, if one exists, simply shadows it.
 *
 * The gateway-only `XTransformPort` query parameter is stripped before
 * forwarding — it is routing metadata, not API input.
 */

const API_BASE = process.env.PRELIFE_API_URL ?? "http://127.0.0.1:3031";

const BODYLESS_METHODS = new Set(["GET", "HEAD"]);

async function proxy(
  req: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> },
): Promise<NextResponse> {
  const { path = [] } = await ctx.params;
  const incoming = new URL(req.url);
  incoming.searchParams.delete("XTransformPort");
  const qs = incoming.searchParams.toString();
  const target = `${API_BASE}/api/${path.map(encodeURIComponent).join("/")}${qs ? `?${qs}` : ""}`;

  const fwd = new Headers();
  const contentType = req.headers.get("content-type");
  if (contentType) fwd.set("content-type", contentType);
  const accept = req.headers.get("accept");
  if (accept) fwd.set("accept", accept);
  const cookie = req.headers.get("cookie");
  if (cookie) fwd.set("cookie", cookie);

  let body: ArrayBuffer | undefined;
  if (!BODYLESS_METHODS.has(req.method)) {
    body = await req.arrayBuffer();
  }

  try {
    const res = await fetch(target, {
      method: req.method,
      headers: fwd,
      body: body && body.byteLength > 0 ? body : undefined,
      cache: "no-store",
      redirect: "manual",
    });

    const buf = await res.arrayBuffer();
    const headers = new Headers();
    const resCt = res.headers.get("content-type");
    if (resCt) headers.set("content-type", resCt);
    const location = res.headers.get("location");
    if (location) headers.set("location", location);

    const out = new NextResponse(buf, { status: res.status, headers });
    for (const c of res.headers.getSetCookie()) {
      out.headers.append("set-cookie", c);
    }
    return out;
  } catch {
    return NextResponse.json(
      { error: "api_unavailable", message: "prelife-api is not reachable" },
      { status: 502 },
    );
  }
}

export const dynamic = "force-dynamic";

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
