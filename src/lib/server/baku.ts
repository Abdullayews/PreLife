/**
 * Baku wall-clock helpers — Azerbaijan runs UTC+4 year-round (no DST
 * since 2016). Ported verbatim from the Rust baku.rs / mirrors
 * src/lib/psychology.ts.
 */

export const BAKU_OFFSET_MS = 4 * 60 * 60 * 1000;

export type BakuParts = {
  /** "YYYY-MM-DD" */
  date: string;
  /** 0–23 */
  hour: number;
  /** Mon=1 … Sun=7 */
  weekday: number;
};

export function bakuParts(now = Date.now()): BakuParts {
  const shifted = new Date(now + BAKU_OFFSET_MS);
  const day = shifted.getUTCDay(); // Sun=0 … Sat=6
  return {
    date: shifted.toISOString().slice(0, 10),
    hour: shifted.getUTCHours(),
    weekday: day === 0 ? 7 : day,
  };
}

/** UTC instant (ms) of a Baku wall-clock date ("YYYY-MM-DD") + hour. */
export function bakuInstant(date: string, hour: number): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), hour, 0, 0) - BAKU_OFFSET_MS;
}

/** Weekday (Mon=1 … Sun=7) of a "YYYY-MM-DD" date, or null when malformed. */
export function weekdayOf(date: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  const day = d.getUTCDay();
  return day === 0 ? 7 : day;
}
