/**
 * Client-side API routing: every browser fetch goes through the sandbox
 * gateway, which needs the target port in the query string. Server
 * components talk to the Rust API directly (see lib/api.ts) — only browser
 * code uses this helper.
 */
export const API_PORT = 3031;

export function apiUrl(path: string): string {
  return `${path}${path.includes("?") ? "&" : "?"}XTransformPort=${API_PORT}`;
}
