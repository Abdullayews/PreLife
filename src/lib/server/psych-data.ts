import { getMessages } from "next-intl/server";
import { bakuInstant, bakuParts, weekdayOf } from "./baku";
import {
  authAdminGetUser,
  supaDelete,
  supaInsert,
  supaSelect,
  supaSelectOne,
  supaUpdate,
} from "./supa";
import {
  buildPaymentDueMail,
  buildRequestDeclinedMail,
  sendMail,
} from "./mail";
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
    message: typeof r.message === "string" ? r.message : null,
    respondedAt: typeof r.responded_at === "string" ? r.responded_at : null,
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
    // Rust parity: integer numbers pass; JSON floats with a zero fraction
    // (3.0) already parse as JS integers above; fractional numbers and
    // non-numeric strings are rejected below.
    if (typeof a === "number" && Number.isInteger(a)) n = a;
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

/** Day-shift of a "YYYY-MM-DD" string (UTC arithmetic — dates only). */
function plusDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function book(user: SessionUser, body: Row) {
  const slug = typeof body.slug === "string" ? body.slug : "";
  const date = typeof body.date === "string" ? body.date : "";
  const hourRaw = body.hour;
  const mode = body.mode === "office" ? "office" : "online";
  const custom = body.custom === true;

  if (typeof hourRaw !== "number" || !Number.isInteger(hourRaw) || hourRaw < 0 || hourRaw > 23) {
    throw badRequest();
  }
  const hour = hourRaw;
  if (date.length !== 10 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw badRequest();

  // v3.4 request workflow: the client states what they want up front —
  // the psychologist confirms from their own console before any payment.
  const rawMessage = typeof body.message === "string" ? body.message : "";
  const message = rawMessage.trim();
  const messageLen = [...message].length;
  if (messageLen < 1 || messageLen > 1000) throw badRequest();

  const psy = await supaSelectOne("psychologists_v2", [
    ["select", "slug,price"], ["slug", `eq.${slug}`],
  ]);
  if (!psy) throw badRequest();

  const startMs = bakuInstant(date, hour);
  if (startMs === null) throw badRequest();
  if (bakuParts(startMs).date !== date) throw badRequest();

  if (!custom) {
    // The slot must fall into a weekly working block (Baku wall-clock).
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
  } else {
    // Custom time: the psychologist decides — skip the weekly blocks, but
    // keep sane bounds (06:00–23:00, within the next 60 days from Baku
    // today; yesterday and earlier reads as a past slot).
    if (hour < 6 || hour > 23) throw badRequest();
    const today = bakuParts().date;
    if (date < today) throw new ApiCode(409, "slot_past");
    if (date > plusDays(today, 60)) throw badRequest();
  }
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
    status: "requested",
    payment: "unpaid",
    message,
  });
  return { id: row?.id, status: "requested" };
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
    ["select", "id,user_id,status"], ["id", `eq.${id}`],
  ]);
  if (!row || row.user_id !== user.id) throw notFound();
  // v3.4: payment only opens AFTER the psychologist confirmed the request.
  if (row.status !== "confirmed") throw new ApiCode(409, "not_confirmed");
  await supaUpdate("appointments", [["id", `eq.${String(row.id)}`]], {
    payment: "paid",
    status: "upcoming",
  });
  return { ok: true };
}

/* ── Psychologist console (v3.4 request workflow) ───────────────────────── */

/** The console guard: only a linked psychologist account gets through. */
function requirePsychConsole(user: SessionUser): string {
  if (user.role !== "psychologist" || typeof user.psychSlug !== "string" || !user.psychSlug) {
    throw unauthorized();
  }
  return user.psychSlug;
}

/** "12 dekabr 2026, 15:00" — a Baku wall-clock label in the client's own
 * locale (built from Intl parts so every locale keeps its word order). */
function bakuLabel(locale: string, startAt: string): string {
  const fmt = new Intl.DateTimeFormat(locale, {
    day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "Asia/Baku",
  });
  const parts = fmt.formatToParts(new Date(startAt));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")} ${get("month")} ${get("year")}, ${get("hour")}:${get("minute")}`;
}

/** The psychologist's display name in the CLIENT's locale: the catalog's
 * name_key resolved against the psychApp message tree (the exact key the
 * psychologists page renders through t(psy.nameKey)). Falls back to the
 * slug when the catalog or the key is unavailable. */
async function psyDisplayName(locale: string, slug: string): Promise<string> {
  try {
    const psy = await supaSelectOne("psychologists_v2", [
      ["select", "name_key"], ["slug", `eq.${slug}`],
    ]);
    const nameKey = psy && typeof psy.name_key === "string" ? psy.name_key : "";
    if (!nameKey) return slug;
    const messages = (await getMessages({ locale })) as Record<string, unknown>;
    const tree = messages.psychApp as Record<string, unknown> | undefined;
    const name = tree?.[nameKey];
    return typeof name === "string" && name ? name : slug;
  } catch {
    return slug;
  }
}

/** One client of the console: e-mail from auth.users, name from profiles. */
async function clientOf(userId: string): Promise<{ name: string | null; email: string | null }> {
  let email: string | null = null;
  let name: string | null = null;
  try {
    const au = await authAdminGetUser(userId);
    if (typeof au.email === "string") email = au.email;
  } catch {
    /* auth lookup failed — the row still renders with a null e-mail */
  }
  try {
    const prof = await supaSelectOne("profiles", [
      ["select", "full_name"], ["id", `eq.${userId}`],
    ]);
    if (prof && typeof prof.full_name === "string" && prof.full_name) name = prof.full_name;
  } catch {
    /* profile row may lag */
  }
  return { name, email };
}

/** GET /api/psych/console — the linked psychologist's three queues. */
export async function consoleList(user: SessionUser) {
  const slug = requirePsychConsole(user);

  const [pending, confirmed, upcoming, avail] = await Promise.all([
    sel("appointments", [
      ["select", "*"],
      ["psychologist_slug", `eq.${slug}`],
      ["status", "eq.requested"],
      ["order", "start_at.asc"],
      ["limit", "20"],
    ]),
    sel("appointments", [
      ["select", "*"],
      ["psychologist_slug", `eq.${slug}`],
      ["status", "eq.confirmed"],
      ["order", "start_at.asc"],
      ["limit", "10"],
    ]),
    sel("appointments", [
      ["select", "*"],
      ["psychologist_slug", `eq.${slug}`],
      ["status", "eq.upcoming"],
      ["start_at", `gt.${nowIso()}`],
      ["order", "start_at.asc"],
      ["limit", "10"],
    ]),
    sel("psychologist_availability", [
      ["select", "day,from_hour,to_hour"],
      ["psychologist_slug", `eq.${slug}`],
    ]),
  ]);

  // Client lookups (auth + profile), deduplicated per user id.
  const clients = new Map<string, { name: string | null; email: string | null }>();
  const lookup = async (userId: string) => {
    const hit = clients.get(userId);
    if (hit) return hit;
    const out = await clientOf(userId);
    clients.set(userId, out);
    return out;
  };

  // A slot outside every weekly working block = a custom-time request.
  const isCustom = (r: Row): boolean => {
    const ts = Date.parse(String(r.start_at));
    if (!Number.isFinite(ts)) return false;
    const { hour, weekday } = bakuParts(ts);
    return !avail.some((b) =>
      b.day === weekday
      && hour >= (typeof b.from_hour === "number" ? b.from_hour : -1)
      && hour < (typeof b.to_hour === "number" ? b.to_hour : -1),
    );
  };

  const view = async (r: Row) => ({
    ...appointmentView(r),
    custom: isCustom(r),
    client: await lookup(String(r.user_id)),
  });

  const mapWith = async (rows: Row[]) => {
    const out: Awaited<ReturnType<typeof view>>[] = [];
    for (const r of rows) out.push(await view(r));
    return out;
  };

  return {
    slug,
    pending: await mapWith(pending),
    confirmed: await mapWith(confirmed),
    upcoming: await mapWith(upcoming),
  };
}

/** POST /api/psych/console { id, action } — confirm / decline a request.
 * Confirming sends the payment-due e-mail; declining the polite refusal. */
export async function consoleRespond(user: SessionUser, body: Row, origin: string) {
  const slug = requirePsychConsole(user);

  const id = typeof body.id === "string" ? body.id : "";
  const action = body.action === "confirm" ? "confirm" : body.action === "decline" ? "decline" : "";
  if (!id || !action) throw badRequest();

  const row = await supaSelectOne("appointments", [
    ["select", "*"], ["id", `eq.${id}`],
  ]);
  if (!row || row.psychologist_slug !== slug) throw notFound();
  if (row.status !== "requested") throw new ApiCode(409, "not_confirmed");

  const now = nowIso();
  if (action === "confirm") {
    await supaUpdate("appointments", [["id", `eq.${id}`]], {
      status: "confirmed",
      responded_at: now,
    });
  } else {
    await supaUpdate("appointments", [["id", `eq.${id}`]], {
      status: "cancelled",
      responded_at: now,
    });
  }

  // Best-effort outcome mail — a mail failure never fails the response.
  try {
    const userId = String(row.user_id);
    const { email } = await clientOf(userId);
    if (email) {
      let locale = "az";
      try {
        const prof = await supaSelectOne("profiles", [
          ["select", "lang"], ["id", `eq.${userId}`],
        ]);
        if (prof && (prof.lang === "en" || prof.lang === "ru" || prof.lang === "az")) {
          locale = prof.lang;
        }
      } catch {
        /* default az */
      }
      const psychologist = await psyDisplayName(locale, slug);
      const startAtLabel = bakuLabel(locale, String(row.start_at));
      if (action === "confirm") {
        await sendMail({
          to: email,
          kind: "session_confirmed",
          ...buildPaymentDueMail(locale, {
            psychologist,
            startAtLabel,
            mode: row.mode === "office" ? "office" : "online",
            price: typeof row.price === "number" ? row.price : null,
            link: `${origin}/meditation/bookings`,
          }),
        });
      } else {
        await sendMail({
          to: email,
          kind: "session_declined",
          ...buildRequestDeclinedMail(locale, { psychologist, startAtLabel }),
        });
      }
    }
  } catch (e) {
    console.error("[psych:console mail]", e);
  }

  return { ok: true, status: action === "confirm" ? "confirmed" : "cancelled" };
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

  // v3.4: the dashboard's "nearest sessions" strip also carries pending
  // (requested/confirmed) requests, not only paid-up upcoming ones.
  const upcoming = await sel("appointments", [
    ["select", "*"],
    ["user_id", `eq.${user.id}`],
    ["status", "in.(requested,confirmed,upcoming)"],
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
