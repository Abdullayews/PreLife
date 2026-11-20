/**
 * Client-side API routing: browser fetches use relative /api/… paths.
 * In the sandbox the backend is the Rust service (mini-services/
 * prelife-api) on its own port, and the preview gateway routes by the
 * XTransformPort query param; production serves /api/* from the same
 * origin behind a reverse proxy and leaves the env unset.
 */
const PORT = process.env.NEXT_PUBLIC_API_TRANSFORM_PORT ?? "";

export function apiUrl(path: string): string {
  if (!PORT || path.includes("XTransformPort=")) return path;
  return path + (path.includes("?") ? "&" : "?") + `XTransformPort=${PORT}`;
}
