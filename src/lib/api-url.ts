/**
 * Client-side API routing: browser fetches use plain relative /api/...
 * paths — they are served by THIS Next.js app (the merged backend lives
 * in src/app/api/*). Server components call the same logic directly
 * through src/lib/api.ts (no HTTP hop).
 */
export function apiUrl(path: string): string {
  return path;
}
