/** Only same-origin paths may be used as a post-login destination. */
export function safeNext(next?: string): string | undefined {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : undefined;
}
