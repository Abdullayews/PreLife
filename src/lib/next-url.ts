import { routing } from "@/i18n/routing";

/**
 * Only same-origin paths may be used as a post-login destination.
 *
 * v5.2 (loop iter 3, security round): a `next` that already carries a
 * locale prefix (`/en/gym` — e.g. hand-crafted or from an old link) used
 * to become `/en/en/gym` after the post-login `router.push` re-prefixed
 * the locale, landing on a 404. The prefix is stripped so both
 * `/gym` and `/en/gym` land on the same place.
 */
export function safeNext(next?: string): string | undefined {
  // Backslash guard: WHATWG URL parsing folds "\e" → "/e" after a leading
  // slash, so "/\evil.com" would become protocol-relative — reject it.
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return undefined;
  }
  const m = next.match(/^\/([a-z]{2})(?=\/|$)/);
  if (m && (routing.locales as readonly string[]).includes(m[1])) {
    next = next.slice(m[1].length + 1) || "/";
    if (next === "") next = "/";
  }
  return next;
}
