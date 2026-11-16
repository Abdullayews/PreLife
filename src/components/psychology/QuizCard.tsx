"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { LoaderCircle } from "lucide-react";

export type QuizLabel = { title: string; desc: string; questions: { q: string; opts: string[] }[] };
export type QuizLabels = Record<string, QuizLabel>;

/** Small self-check quizzes (stress / sleep / focus — 3 questions, four
 *  answers each, scored 0–9 server-side). Labels come pre-translated
 *  from the server page so no dynamic message keys are needed here. */
export function QuizCard({ labels, zones }: { labels: QuizLabels; zones: { low: string; mid: string; high: string } }) {
  const t = useTranslations("meditationApp");
  const router = useRouter();
  const ids = Object.keys(labels);
  const [active, setActive] = useState(ids[0] ?? "");
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<{ score: number; maxScore: number } | null>(null);
  const [pending, start] = useTransition();

  const quiz = labels[active];
  const ready = quiz !== undefined && answers.length === quiz.questions.length && answers.every((a) => a >= 0);

  const pickQuiz = (id: string) => {
    setActive(id);
    setAnswers([]);
    setResult(null);
  };

  const answer = (qi: number, oi: number) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[qi] = oi;
      return next;
    });
  };

  const submit = () =>
    start(async () => {
      const res = await fetch("/api/psychology/quiz", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ quizId: active, answers: answers.map((a) => a ?? -1) }),
      });
      if (res.ok) {
        const data = (await res.json()) as { score: number; maxScore: number };
        setResult(data);
        router.refresh();
      }
    });

  const zone = result
    ? result.score <= result.maxScore / 3 ? zones.low : result.score <= (result.maxScore * 2) / 3 ? zones.mid : zones.high
    : "";

  return (
    <div className="card quiz">
      <div className="psy-filter-row">
        {ids.map((id) => (
          <button
            key={id}
            type="button"
            className="filter"
            aria-pressed={active === id}
            onClick={() => pickQuiz(id)}
          >
            {labels[id]!.title}
          </button>
        ))}
      </div>

      {quiz && !result && (
        <>
          <p className="lede">{quiz.desc}</p>
          {quiz.questions.map((q, qi) => (
            <div className="quiz-q" key={qi}>
              <p>{`${qi + 1}. ${q.q}`}</p>
              <div className="quiz-opts" role="group" aria-label={q.q}>
                {q.opts.map((opt, oi) => (
                  <button key={oi} type="button" aria-pressed={answers[qi] === oi} onClick={() => answer(qi, oi)}>
                    <i aria-hidden />
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="psy-actions">
            <button type="button" className="btn" onClick={submit} disabled={!ready || pending}>
              {pending && <LoaderCircle size={16} className="spin" aria-hidden />}
              {t("quizSubmit")}
            </button>
          </div>
        </>
      )}

      {quiz && result && (
        <div className="quiz-score" role="status">
          <b>{result.score} / {result.maxScore}</b>
          <p>{zone}</p>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setResult(null)}>
            {t("quizAgain")}
          </button>
        </div>
      )}

      <p className="chat-disclaim">{t("quizDisclaimer")}</p>
    </div>
  );
}
