import { NextResponse, type NextRequest } from "next/server";
import { emuData, emuEnabled, emuTouch, type Row } from "@/lib/server/emu/store";

/**
 * The local PostgREST emulator — GET/POST/PATCH/DELETE on
 * /api/supa-emu/rest/v1/{table}. DEV ONLY (SUPABASE_EMU=1); production
 * traffic goes to the real Supabase REST endpoint via lib/server/supa.ts.
 *
 * Supported query params (the subset the backend uses):
 *   ?col=eq.v / neq.v / lt.v / lte.v / gt.v / gte.v / is.null / in.(a,b)
 *   &order=col.asc,col.desc &limit=N &offset=N          (select is accepted
 *   and ignored — full rows come back, callers destructure their fields).
 */

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ table: string }> };

const RESERVED = new Set(["select", "order", "limit", "offset"]);
const OPS = ["gte.", "lte.", "neq.", "eq.", "gt.", "lt.", "is.", "in."] as const;
type Op = "eq" | "neq" | "lt" | "lte" | "gt" | "gte" | "is" | "in";

function parseFilter(raw: string): { op: Op; value: string } | null {
  for (const p of OPS) {
    if (raw.startsWith(p)) {
      return { op: p.slice(0, -1) as Op, value: raw.slice(p.length) };
    }
  }
  return null;
}

function looseEq(rowVal: unknown, raw: string): boolean {
  if (rowVal === null || rowVal === undefined) return false;
  if (typeof rowVal === "number") {
    const n = Number(raw);
    return Number.isNaN(n) ? String(rowVal) === raw : rowVal === n;
  }
  if (typeof rowVal === "boolean") return rowVal === (raw === "true");
  return String(rowVal) === raw;
}

function matches(row: Row, col: string, op: Op, raw: string): boolean {
  const v = row[col];
  switch (op) {
    case "is": {
      const want = raw === "null" ? null : raw === "true" ? true : raw === "false" ? false : raw;
      return v === want;
    }
    case "in": {
      const opts = raw.replace(/^\(/, "").replace(/\)$/, "").split(",").map((s) => s.trim());
      return opts.some((o) => looseEq(v, o));
    }
    case "eq": return looseEq(v, raw);
    case "neq": return !looseEq(v, raw);
  }
  // ordered ops
  if (v === null || v === undefined) return false;
  if (typeof v === "number") {
    const n = Number(raw);
    if (Number.isNaN(n)) return false;
    return op === "lt" ? v < n : op === "lte" ? v <= n : op === "gt" ? v > n : v >= n;
  }
  if (typeof v === "boolean") {
    const b = raw === "true";
    return op === "lt" ? v < b : op === "lte" ? v <= b : op === "gt" ? v > b : v >= b;
  }
  const s = String(v);
  return op === "lt" ? s < raw : op === "lte" ? s <= raw : op === "gt" ? s > raw : s >= raw;
}

function filterRows(rows: Row[], sp: URLSearchParams): Row[] {
  const filters: { col: string; op: Op; raw: string }[] = [];
  for (const [key, raw] of sp.entries()) {
    if (RESERVED.has(key)) continue;
    const f = parseFilter(raw);
    if (f) filters.push({ col: key, op: f.op, raw: f.value });
  }
  if (!filters.length) return rows;
  return rows.filter((row) => filters.every((f) => matches(row, f.col, f.op, f.raw)));
}

function sortRows(rows: Row[], order: string | null): Row[] {
  if (!order) return rows;
  const specs = order.split(",").map((part) => {
    const [col, dir] = part.trim().split(".");
    return { col, dir: dir === "desc" ? -1 : 1 };
  }).filter((s) => s.col);
  if (!specs.length) return rows;
  return [...rows].sort((a, b) => {
    for (const { col, dir } of specs) {
      const av = a[col]; const bv = b[col];
      if (av === bv) continue;
      if (av === null || av === undefined) return 1;  // nulls last
      if (bv === null || bv === undefined) return -1; // nulls last
      const an = typeof av === "number"; const bn = typeof bv === "number";
      const cmp = an && bn ? (av as number) - (bv as number)
        : String(av) < String(bv) ? -1 : 1;
      if (cmp !== 0) return cmp * dir;
    }
    return 0;
  });
}

function guard(): NextResponse | null {
  return emuEnabled() ? null : NextResponse.json({ message: "not found" }, { status: 404 });
}

/* ── GET: select with filters / order / limit / offset ──────────────────── */
export async function GET(req: NextRequest, ctx: Ctx): Promise<NextResponse> {
  const blocked = guard();
  if (blocked) return blocked;
  const { table } = await ctx.params;
  const data = emuData();
  const rows = data.tables[table] ?? [];
  const sp = req.nextUrl.searchParams;

  let out = filterRows(rows, sp);
  out = sortRows(out, sp.get("order"));

  const offset = Number(sp.get("offset") ?? "0");
  if (Number.isFinite(offset) && offset > 0) out = out.slice(offset);
  const limit = Number(sp.get("limit") ?? "0");
  if (Number.isFinite(limit) && limit > 0) out = out.slice(0, limit);

  return NextResponse.json(out);
}

/* ── POST: insert (object or array) — Prefer: return=representation ─────── */
export async function POST(req: NextRequest, ctx: Ctx): Promise<NextResponse> {
  const blocked = guard();
  if (blocked) return blocked;
  const { table } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "invalid json" }, { status: 400 });
  }
  const list = Array.isArray(body) ? body : [body];
  if (!list.length || list.some((r) => !r || typeof r !== "object")) {
    return NextResponse.json({ message: "invalid body" }, { status: 400 });
  }
  const data = emuData();
  const rows = data.tables[table] ?? (data.tables[table] = []);
  const created: Row[] = [];
  const now = new Date().toISOString();
  for (const raw of list as Row[]) {
    const row: Row = { ...raw };
    if (row.id === undefined || row.id === null || row.id === "") {
      row.id = crypto.randomUUID();
    }
    if (row.created_at === undefined) row.created_at = now;
    if (row.updated_at === undefined) row.updated_at = row.created_at;
    rows.push(row);
    created.push(row);
  }
  emuTouch();
  return NextResponse.json(created, { status: 201 });
}

/* ── PATCH: update rows matching the filters ────────────────────────────── */
export async function PATCH(req: NextRequest, ctx: Ctx): Promise<NextResponse> {
  const blocked = guard();
  if (blocked) return blocked;
  const { table } = await ctx.params;
  let body: Row;
  try {
    body = (await req.json()) as Row;
  } catch {
    return NextResponse.json({ message: "invalid json" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ message: "invalid body" }, { status: 400 });
  }
  const data = emuData();
  const rows = data.tables[table] ?? [];
  const targets = filterRows(rows, req.nextUrl.searchParams);
  const now = new Date().toISOString();
  for (const row of targets) {
    Object.assign(row, body, { updated_at: now });
  }
  emuTouch();
  return NextResponse.json(targets);
}

/* ── DELETE: remove rows matching the filters ───────────────────────────── */
export async function DELETE(req: NextRequest, ctx: Ctx): Promise<NextResponse> {
  const blocked = guard();
  if (blocked) return blocked;
  const { table } = await ctx.params;
  const data = emuData();
  const rows = data.tables[table] ?? [];
  const doomed = new Set(filterRows(rows, req.nextUrl.searchParams));
  if (doomed.size) {
    data.tables[table] = rows.filter((r) => !doomed.has(r));
    emuTouch();
  }
  return new NextResponse(null, { status: 204 });
}
