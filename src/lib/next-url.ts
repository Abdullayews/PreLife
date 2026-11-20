/** Only same-origin paths may be used as a post-login destination. */
export function safeNext(next?: string): string | undefined {
  // Backslash guard: WHATWG URL parsing folds "\e" → "/e" after a leading
  // slash, so "/\evil.com" would become protocol-relative — reject it.
  return next && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\")
    ? next
    : undefined;
}
