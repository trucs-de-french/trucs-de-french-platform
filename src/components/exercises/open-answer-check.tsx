"use client";

import { useState } from "react";
import type { OpenAnswerPublic, OpenAnswerDetail } from "@/lib/exercises/types";
import { useExerciseCheck } from "./use-exercise-check";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";
import { pluralizePoints } from "@/lib/pluralize-points";

// На відміну від EssayCheckExercise (essay_check, AI/Gemini-перевірка
// розгорнутого тексту), тут коротка відповідь звіряється з фіксованим
// списком прийнятних варіантів — той самий принцип, що для одного пропуску
// у fill_blank, через спільний /api/exercises/check. Кілька питань під
// однією вправою — та сама модель, що listening.tsx.
export function OpenAnswerCheckExercise({
  taskId,
  config,
  pointsVisible,
}: {
  taskId: string;
  config: OpenAnswerPublic;
  pointsVisible: boolean;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const { submit, pending, result, error } = useExerciseCheck(taskId);
  const detail = result?.detail as OpenAnswerDetail | undefined;

  const allAnswered = config.questions.every((q) => answers[q.id]?.trim());

  return (
    <div>
      <p className="mb-2 font-medium">{config.instructions ?? DEFAULT_INSTRUCTIONS.open_answer}</p>

      <div className="flex flex-col gap-3">
        {config.questions.map((q) => {
          const qDetail = detail?.questions.find((d) => d.id === q.id);
          return (
            <div key={q.id}>
              <p className="text-sm font-medium">
                {q.question}
                {/* До перевірки — лише якщо pointsVisible; після — завжди. */}
                {(pointsVisible || qDetail) && (
                  <span className="ml-2 text-xs font-normal text-neutral-500 dark:text-neutral-400">
                    {qDetail
                      ? `${qDetail.isCorrect ? qDetail.points : 0}/${qDetail.points} ${pluralizePoints(qDetail.points)}`
                      : `${q.points} ${pluralizePoints(q.points)}`}
                  </span>
                )}
              </p>
              <input
                value={answers[q.id] ?? ""}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                disabled={!!result}
                className={`mt-1 w-full rounded-md border px-2 py-1.5 text-sm ${
                  qDetail
                    ? qDetail.isCorrect
                      ? "border-green-500 bg-green-50 dark:bg-green-950/30"
                      : "border-red-500 bg-red-50 dark:bg-red-950/30"
                    : ""
                }`}
                placeholder="Ваша відповідь..."
              />
              {qDetail && !qDetail.isCorrect && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  Правильно: {qDetail.correctAnswers.join(" / ")}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {!result ? (
        <button
          type="button"
          onClick={() =>
            submit(config.questions.map((q) => ({ questionId: q.id, value: answers[q.id] ?? "" })))
          }
          disabled={pending || !allAnswered}
          className="mt-3 rounded-md bg-black px-3 py-1.5 text-sm text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
        >
          {pending ? "Перевіряю..." : "Перевірити"}
        </button>
      ) : (
        <p
          className={`mt-3 text-sm font-medium ${
            result.correct ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
          }`}
        >
          {result.correct ? "Правильно! ✓" : `Результат: ${result.score}%`}
          {result.pointsPossible !== undefined && (
            <span className="ml-2 font-normal text-neutral-500 dark:text-neutral-400">
              ({result.pointsEarned} з {result.pointsPossible} {pluralizePoints(result.pointsPossible)})
            </span>
          )}
        </p>
      )}

      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
