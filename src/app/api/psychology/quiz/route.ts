import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { QUIZ_MAX_SCORE } from "@/lib/psychology";

/** POST /api/psychology/quiz — store a finished self-check quiz.
 *  Body: { quizId: "stress" | "sleep" | "focus", answers: number[] }
 *  (each answer 0–3). The score is derived server-side. */
export async function POST(req: Request) {
  const current = await getSession();
  if (!current) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as { quizId?: unknown; answers?: unknown };
  const quizId = typeof body.quizId === "string" ? body.quizId : "";
  const answers = Array.isArray(body.answers) ? body.answers : [];

  if (!["stress", "sleep", "focus"].includes(quizId) || answers.length === 0 || answers.length > 6) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const clean = answers.map((a) => Number(a));
  if (clean.some((a) => !Number.isInteger(a) || a < 0 || a > 3)) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const score = clean.reduce((sum, a) => sum + a, 0);
  try {
    const row = await db.quizResult.create({
      data: {
        userId: current.user.id, quizId, score,
        maxScore: Math.max(QUIZ_MAX_SCORE, clean.length * 3),
        answers: JSON.stringify(clean),
      },
    });
    return NextResponse.json({ id: row.id, score, maxScore: row.maxScore }, { status: 201 });
  } catch (err) {
    console.error("[psychology:quiz]", err);
    return NextResponse.json({ error: "generic" }, { status: 500 });
  }
}
