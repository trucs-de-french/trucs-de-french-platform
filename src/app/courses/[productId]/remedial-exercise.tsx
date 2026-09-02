"use client";

import { useState } from "react";
import type { FillBlankPublic, FillBlankDetail } from "@/lib/exercises/types";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";

type GradeResult = { correct: boolean; score: number; detail: FillBlankDetail };

// Не через useExerciseCheck (той жорстко прив'язаний до /api/exercises/check
// + taskId — узагальнювати спільний для всієї платформи хук заради одного
// нового місця використання недоцільно) — власний маленький fetch до
// /api/delf/remedial-exercises/check + exerciseId.
export function RemedialExercise({
  exerciseId,
  config,
  initialStudentAnswer,
  initialScore,
}: {
  exerciseId: string;
  config: FillBlankPublic;
  initialStudentAnswer: string[] | null;
  initialScore: number | null;
}) {
  const segments = config.template.split("{{}}");
  const blankCount = segments.length - 1;
  const [answers, setAnswers] = useState<string[]>(() =>
    initialStudentAnswer && initialStudentAnswer.length === blankCount
      ? initialStudentAnswer
      : Array(blankCount).fill("")
  );
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<GradeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const detail = result?.detail;
  const done = initialScore !== null || !!result;
  const displayScore = result?.score ?? initialScore;

  async function submit() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/delf/remedial-exercises/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exerciseId, answer: answers }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Помилка перевірки");
      }

      setResult((await res.json()) as GradeResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Помилка перевірки");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-md border p-3">
      <p className="mb-2 text-sm font-medium">
        {config.instructions ?? DEFAULT_INSTRUCTIONS.fill_blank}
      </p>
      <p className="text-sm leading-8">
        {segments.map((seg, i) => (
          <span key={i}>
            {seg}
            {i < blankCount && (
              <input
                value={answers[i]}
                onChange={(e) =>
                  setAnswers((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))
                }
                disabled={done}
                className={`mx-1 w-28 rounded border px-2 py-0.5 text-sm ${
                  detail
                    ? detail.blanks[i]?.isCorrect
                      ? "border-green-500 bg-green-50 dark:bg-green-950/30"
                      : "border-red-500 bg-red-50 dark:bg-red-950/30"
                    : ""
                }`}
              />
            )}
          </span>
        ))}
      </p>

      {!done ? (
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="mt-2 rounded-md bg-black px-3 py-1.5 text-sm text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
        >
          {pending ? "Перевіряю..." : "Перевірити"}
        </button>
      ) : (
        <p className="mt-2 text-sm font-medium text-neutral-600 dark:text-neutral-400">
          {displayScore !== null ? `Результат: ${displayScore}%` : "Пройдено"}
        </p>
      )}

      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
