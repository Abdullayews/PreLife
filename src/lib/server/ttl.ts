/**
 * Tiny per-process TTL cache for content endpoints and the i18n catalog —
 * one entry per logical response, refreshed at most once per TTL window.
 * The direct port of the Rust service's TtlCache (60s).
 */

const TTL_MS = 60_000;

type Entry = { at: number; v: unknown };

const store = new Map<string, Entry>();

export async function ttlGet<T>(key: string): Promise<T | null> {
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at >= TTL_MS) {
    store.delete(key);
    return null;
  }
  return hit.v as T;
}

export function ttlPut(key: string, v: unknown): void {
  store.set(key, { at: Date.now(), v });
}
