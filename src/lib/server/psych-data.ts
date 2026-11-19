import { bakuInstant, bakuParts, weekdayOf } from "./baku";
import {
  supaDelete,
  supaInsert,
  supaSelect,
  supaSelectOne,
  supaUpdate,
} from "./supa";
import type { SessionUser } from "./session";

/**
 * Psychology-section data endpoints — the direct port of the Rust
 * psych.rs. Every function receives the REAL session user (no anonymous
 * access, no fallback account); the app pages are login-gated on the
 * frontend, so an anonymous caller only gets 401 at the route layer.
 *
 * Errors are thrown as ApiCode { status, code } — the route handlers
 * turn them into { error: code } responses, exactly like the Rust
 * ApiError did.
 */

export class ApiCode extends Error {
  constructor(public status: number, public code: string) {
    super(code);
  }
}

export const badRequest = () => new ApiCode(400, "invalid");
export const unauthorized = () => new ApiCode(401, "unauthorized");
export const notFound = () => new ApiCode(404, "not_found");
export const genericError = () => new ApiCode(500, "generic");

type Row = Record<string, unknown>;

function nowIso(): string {
  return new Date().toISOString();
}

function isoPlus(ms: number): string {
  return new Date(Date.now() + ms).toISOString();
}

/* ── camelCase row views ─────────────────────────────────────────────────── */

function journalView(r: Row) {
  return {
    id: r.id,
    promptKey: r.prompt_key,
    content: r.content,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function moodView(r: Row) {
  return {
    id: r.id,
    date: r.date,
    mood: r.mood,
    energy: r.energy,
    sleepQ: r.sleep_q,
    tags: r.tags,
    note: r.note,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function appointmentView(r: Row) {
  return {
    id: r.id,
    psychologistSlug: r.psychologist_slug,
    startAt: r.start_at,
    mode: r.mode,
    price: r.price ?? null,
    status: r.status,
    payment: r.payment,
    createdAt: r.created_at,
  };
}

async function sel(table: string, params: [string, string][]): Promise<Row[]> {
  return (await supaSelect(table, params)) as Row[];
}

/* ── Journal ─────────────────────────────────────────────────────────────── */

export async function journalList(user: SessionUser) {
  const entries = await sel("journal_entries_v2", [
    ["select", "*"],
    ["user_id", `eq.${user.id}`],
    ["order", "created_at.desc"],
    ["limit", "200"],
  ]);
  const moods = await sel("mood_logs", [
    ["select", "date,mood,energy,sleep_q"],
    ["user_id", `eq.${user.id}`],
    ["order", "date.asc"],
    ["limit", "365"],
  ]);
  return {
    entries: entries.map(journalView),
    moods: moods.map(moodView),
  };
}

export async function journalCreate(user: SessionUser, body: Row) {
  const rawContent = body.content;
  const content = typeof rawContent === "string" ? rawContent.trim() : "";
  const rawPrompt = body.promptKey;
  const promptKey = typeof rawPrompt === "string" && rawPrompt.length <= 80 ? rawPrompt : null;
  if (!content || [...content].length > 4000) throw badRequest();
  const row = await supaInsert("journal_entries_v2", {
    user_id: user.id, content, prompt_key: promptKey,
  });
  return { id: row?.id };
}

export async function journalDelete(user: SessionUser, id: string) {
  if (!id) throw badRequest();
  const row = await supaSelectOne("journal_entries_v2", [
    ["select", "id,user_id"], ["id", `eq.${id}`],
  ]);
  if (!row || row.user_id !== user.id) throw notFound();
  await supaDelete("journal_entries_v2", [["id", `eq.${String(row.id)}`]]);
  return { ok: true };
}

/* ── Mood check-ins ──────────────────────────────────────────────────────── */

export async function moodList(user: SessionUser) {
  const logs = await sel("mood_logs", [
    ["select", "*"],
    ["user_id", `eq.${user.id}`],
    ["order", "date.asc"],
    ["limit", "60"],
  ]);
  const quiz = await sel("quiz_results", [
    ["select", "id,quiz_id,score,max_score,created_at"],
    ["user_id", `eq.${user.id}`],
    ["order", "created_at.desc"],
    ["limit", "6"],
  ]);
  return {
    logs: logs.map(moodView),
    quizResults: quiz.map((q) => ({
      id: q.id, quizId: q.quiz_id,
      score: q.score, maxScore: q.max_score,
      createdAt: q.created_at,
    })),
  };
}

export async function moodUpsert(user: SessionUser, body: Row) {
  const inRange = (v: unknown): boolean => typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 5;
  if (!inRange(body.mood) || !inRange(body.energy) || !inRange(body.sleepQ)) {
    throw badRequest();
  }
  const mood = body.mood as number;
  const energy = body.energy as number;
  const sleepQ = body.sleepQ as number;

  const tags: string[] = [];
  if (Array.isArray(body.tags)) {
    const seen = new Set<string>();
    for (const t of body.tags) {
      if (typeof t === "string" && t.length <= 24 && !seen.has(t)) {
        seen.add(t);
        tags.push(t);
      }
    }
    tags.length = Math.min(tags.length, 5);
  }
  const note = typeof body.note === "string" ? [...body.note.trim()].slice(0, 280).join("") : "";
  const date = bakuParts().date;

  const existing = await supaSelectOne("mood_logs", [
    ["select", "id"],
    ["user_id", `eq.${user.id}`],
    ["date", `eq.${date}`],
  ]);

  const payload = {
    mood, energy, sleep_q: sleepQ,
    tags: tags.join(","),
    note: note || null,
  };
  if (existing) {
    await supaUpdate("mood_logs", [
      ["user_id", `eq.${user.id}`],
      ["date", `eq.${date}`],
    ], payload);
  } else {
    await supaInsert("mood_logs", { ...payload, user_id: user.id, date });
  }
  return { ok: true, date };
}

/* ── Quizzes ─────────────────────────────────────────────────────────────── */

export async function quizSubmit(user: SessionUser, body: Row) {
  const quizId = typeof body.quizId === "string" ? body.quizId : "";
  const answersRaw = Array.isArray(body.answers) ? body.answers : [];

  if (answersRaw.length === 0 || answersRaw.length > 6) throw badRequest();
  const quiz = await supaSelectOne("quizzes", [
    ["select", "code"], ["code", `eq.${quizId}`],
  ]);
  if (!quiz) throw badRequest();

  const answers: number[] = [];
  for (const a of answersRaw) {
    let n: number;
    if (typeof a === "number" && Number.isInteger(a)) n = a;
    else if (typeof a === "number" && Number.isInteger(a)) n = a;
    else if (typeof a === "string" && /^-?\d+$/.test(a)) n = Number(a);
    else throw badRequest();
    if (n < 0 || n > 3) throw badRequest();
    answers.push(n);
  }
  const score = answers.reduce((acc, n) => acc + n, 0);
  const maxScore = Math.max(9, answers.length * 3);
  const row = await supaInsert("quiz_results", {
    user_id: user.id,
    quiz_id: quizId,
    score,
    max_score: maxScore,
    answers,
  });
  return { id: row?.id, score, maxScore };
}

/* ── Bookings ────────────────────────────────────────────────────────────── */

export async function bookCount() {
  const rows = await sel("psychologists_v2", [["select", "slug"]]);
  return { count: rows.length };
}

export async function book(user: SessionUser, body: Row) {
  const slug = typeof body.slug === "string" ? body.slug : "";
  const date = typeof body.date === "string" ? body.date : "";
  const hourRaw = body.hour;
  const mode = body.mode === "office" ? "office" : "online";

  if (typeof hourRaw !== "number" || !Number.isInteger(hourRaw) || hourRaw < 0 || hourRaw > 23) {
    throw badRequest();
  }
  const hour = hourRaw;
  if (date.length !== 10 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw badRequest();

  const psy = await supaSelectOne("psychologists_v2", [
    ["select", "slug,price"], ["slug", `eq.${slug}`],
  ]);
  if (!psy) throw badRequest();

  // The slot must fall into a weekly working block (Baku wall-clock).
  const startMs = bakuInstant(date, hour);
  if (startMs === null) throw badRequest();
  if (bakuParts(startMs).date !== date) throw badRequest();
  const weekday = weekdayOf(date);
  if (weekday === null) throw badRequest();
  const avail = await sel("psychologist_availability", [
    ["select", "day,from_hour,to_hour"],
    ["psychologist_slug", `eq.${slug}`],
  ]);
  const inBlock = avail.some((b) =>
    b.day === weekday
    && hour >= (typeof b.from_hour === "number" ? b.from_hour : -1)
    && hour < (typeof b.to_hour === "number" ? b.to_hour : -1),
  );
  if (!inBlock) throw new ApiCode(409, "slot_closed");
  if (startMs <= Date.now()) throw new ApiCode(409, "slot_past");

  const startIso = new Date(startMs).toISOString();
  const clash = await supaSelectOne("appointments", [
    ["select", "id"],
    ["psychologist_slug", `eq.${slug}`],
    ["start_at", `eq.${startIso}`],
    ["status", "neq.cancelled"],
  ]);
  if (clash) throw new ApiCode(409, "slot_taken");
  const own = await sel("appointments", [
    ["select", "id"],
    ["user_id", `eq.${user.id}`],
    ["start_at", `eq.${startIso}`],
    ["status", "neq.cancelled"],
  ]);
  if (own.length > 0) throw new ApiCode(409, "double_booked");

  const row = await supaInsert("appointments", {
    user_id: user.id,
    psychologist_slug: slug,
    start_at: startIso,
    mode,
    price: psy.price,
    status: "upcoming",
    payment: "unpaid",
  });
  return { id: row?.id };
}

export async function cancel(user: SessionUser, body: Row) {
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) throw badRequest();
  const row = await supaSelectOne("appointments", [
    ["select", "*"], ["id", `eq.${id}`],
  ]);
  if (!row || row.user_id !== user.id) throw notFound();
  const start = typeof row.start_at === "string" ? Date.parse(row.start_at) : NaN;
  if (Number.isFinite(start) && start <= Date.now()) {
    throw new ApiCode(409, "already_started");
  }
  await supaUpdate("appointments", [["id", `eq.${String(row.id)}`]], { status: "cancelled" });
  return { ok: true };
}

export async function pay(user: SessionUser, body: Row) {
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) throw badRequest();
  const row = await supaSelectOne("appointments", [
    ["select", "id,user_id"], ["id", `eq.${id}`],
  ]);
  if (!row || row.user_id !== user.id) throw notFound();
  await supaUpdate("appointments", [["id", `eq.${String(row.id)}`]], { payment: "paid" });
  return { ok: true };
}

/* ── Meditation media progress ───────────────────────────────────────────── */

export async function progress(user: SessionUser, body: Row) {
  const resourceId = typeof body.resourceId === "string" ? body.resourceId : "";
  const seconds = typeof body.seconds === "number" ? body.seconds : NaN;

  const resource = await supaSelectOne("media_resources", [
    ["select", "id,kind"], ["id", `eq.${resourceId}`],
  ]);
  if (!resource) throw badRequest();
  if (!Number.isFinite(seconds) || seconds < 1 || seconds > 7200) throw badRequest();

  await supaInsert("meditation_progress", {
    user_id: user.id,
    resource_id: resourceId,
    kind: resource.kind,
    seconds: Math.round(seconds),
    completed: body.completed === true,
  });
  return { ok: true };
}

/* ── Page-facing aggregates ──────────────────────────────────────────────── */

export async function bookingsList(user: SessionUser) {
  const rows = await sel("appointments", [
    ["select", "*"],
    ["user_id", `eq.${user.id}`],
    ["order", "start_at.desc"],
    ["limit", "60"],
  ]);
  return { appointments: rows.map(appointmentView) };
}

export async function scheduleWindow(user: SessionUser) {
  const rows = await sel("appointments", [
    ["select", "user_id,psychologist_slug,start_at"],
    ["start_at", `gte.${nowIso()}`],
    ["start_at", `lte.${isoPlus(14 * 24 * 60 * 60 * 1000)}`],
    ["status", "neq.cancelled"],
  ]);

  const toPair = (r: Row) => ({ startAt: r.start_at, psychologistSlug: r.psychologist_slug });
  return {
    mine: rows.filter((r) => r.user_id === user.id).map(toPair),
    all: rows.map(toPair),
  };
}

export async function overview(user: SessionUser) {
  const now = nowIso();

  const logs = await sel("mood_logs", [
    ["select", "*"],
    ["user_id", `eq.${user.id}`],
    ["order", "date.desc"],
    ["limit", "60"],
  ]);

  const upcoming = await sel("appointments", [
    ["select", "*"],
    ["user_id", `eq.${user.id}`],
    ["status", "eq.upcoming"],
    ["start_at", `gt.${now}`],
    ["order", "start_at.asc"],
    ["limit", "3"],
  ]);

  const prog = await sel("meditation_progress", [
    ["select", "seconds"],
    ["user_id", `eq.${user.id}`],
    ["created_at", `gte.${isoPlus(-7 * 24 * 60 * 60 * 1000)}`],
  ]);
  const weekSeconds = prog.reduce(
    (acc, r) => acc + (typeof r.seconds === "number" ? r.seconds : 0), 0,
  );

  const done = await sel("appointments", [
    ["select", "id"],
    ["user_id", `eq.${user.id}`],
    ["status", "eq.upcoming"],
    ["start_at", `lte.${now}`],
  ]);

  return {
    logs: logs.map(moodView),
    upcoming: upcoming.map(appointmentView),
    weekSeconds,
    doneSessions: done.length,
  };
}
