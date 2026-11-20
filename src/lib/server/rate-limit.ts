/**
 * In-process rate limiting — fixed-window counters. The site runs as a
 * single merged Next.js service, so process memory is the only shared
 * state available (no Redis in this stack, by design).
 *
 * Windows are keyed by an arbitrary string ("mail:ip:1.2.3.4",
 * "mail:em:user@x", "login:ip:…", "ai:ip:…"). Each key holds
 * {count, resetAt}; a key outside its window starts fresh. The map is
 * pruned opportunistically so it cannot grow without bound.
 *
 * v4.7 (loop iter 1): the auth surface used to be limit-free — a
 * scripted caller could mail-bomb any address through /api/auth/resend
 * and the login e-mail-only path, and brute-force passwords at line
 * rate. These counters close that; they reset on process restart,
 * which is an acceptable trade for the single-service architecture.
 */

type Bucket = { count: number; resetAt: number };

const RG = globalThis as unknown as { __prelifeRateBuckets?: Map<string, Bucket> };
const buckets: Map<string, Bucket> = (RG.__prelifeRateBuckets ??= new Map());

/** Hard cap on tracked keys — beyond this, expired ones are swept
 * before any new key is created (an attacker cannot balloon memory
 * with unique keys). */
const MAX_KEYS = 10_000;

function sweep(now: number): void {
  if (buckets.size < MAX_KEYS) return;
  for (const [k, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(k);
  }
}

/** True when the action is allowed (and counted); false when the key
 * is over its limit inside the current window. A blocked call is NOT
 * counted — a denied caller does not extend its own block. */
export function rateAllow(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  sweep(now);
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.count >= limit) return false;
  b.count += 1;
  return true;
}

/** The caller's best-effort IP — behind the gateway the first hop of
 * x-forwarded-for, falling back to x-real-ip, then "unknown" (shared
 * bucket; safe direction — it can only tighten, never bypass). */
export function clientIp(headers: Headers): string {
  const fwd = (headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim();
  if (fwd) return fwd;
  return headers.get("x-real-ip")?.trim() || "unknown";
}

/** The shared mail-send guard: every path that triggers a verification
 * e-mail (signup, resend, the login e-mail-only start) checks this
 * first. Per-IP is generous (shared NATs exist), per-address is tight
 * (a single inbox must never be bombable). 429 on breach. */
export function mailSendAllowed(ip: string, email: string): boolean {
  return (
    rateAllow(`mail:ip:${ip}`, 20, 60 * 60 * 1000)
    && rateAllow(`mail:em:${email}`, 5, 60 * 60 * 1000)
  );
}
