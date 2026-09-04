"use client";

import { useState } from "react";
import type { TrueFalsePublic, TrueFalseDetail } from "@/lib/exercises/types";
import { useExerciseCheck } from "./use-exercise-check";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";
import { SELECTED_OPTION_CLASS } from "./selection-style";
import { pluralizePoints } from "@/lib/pluralize-points";

export function TrueFalseExercise({
  taskId,
  config,
  pointsVisible,
}: {
  taskId: string;
  config: TrueFalsePublic;
  pointsVisible: boolean;
}) {
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const { submit, pending, result, error } = useExerciseCheck(taskId);
  const detail = result?.detail as TrueFalseDetail | undefined;

  const allAnswered = config.statements.every((s) => answers[s.id] !== undefined);

  return (
    <div className="flex flex-col gap-2">
      <p className="font-medium">{config.instructions ?? DEFAULT_INSTRUCTIONS.true_false}</p>
      {config.statements.map((s) => {
        const d = detail?.statements.find((x) => x.id === s.id);
        return (
          <div
            key={s.id}
            className="flex items-center justify-between gap-3 rounded-md border p-2"
          >
            <span className="text-sm">
              {s.text}
              {/* До перевірки — лише якщо pointsVisible; після — завжди,
                  ваше підтверджене рішення. */}
              {(pointsVisible || d) && (
                <span className="ml-2 text-xs text-neutral-500 dark:text-neutral-400">
                  {d
                    ? `${d.isCorrect ? d.points : 0}/${d.points} ${pluralizePoints(d.points)}`
                    : `${s.points} ${pluralizePoints(s.points)}`}
                </span>
              )}
            </span>
            <div className="flex gap-1">
              {[true, false].map((val) => (
                <button
                  key={String(val)}
                  type="button"
                  disabled={!!result}
                  onClick={() => setAnswers((prev) => ({ ...prev, [s.id]: val }))}
                  className={`rounded border px-2 py-1 text-xs ${
                    d
                      ? val === d.correctAnswer
                        ? "border-green-500 bg-green-50 dark:bg-green-950/30"
                        : val === d.studentAnswer
                          ? "border-red-500 bg-red-50 dark:bg-red-950/30"
                          : ""
                      : answers[s.id] === val
                        ? SELECTED_OPTION_CLASS
                        : "hover:bg-neutral-50 dark:hover:bg-neutral-800"
                  }`}
                >
                  {val ? "Vrai" : "Faux"}
                </button>
              ))}
            </div>
          </div>
        );
      })}

      {!result ? (
        <button
          type="button"
          onClick={() =>
            submit(config.statements.map((s) => ({ id: s.id, value: answers[s.id] })))
          }
          disabled={pending || !allAnswered}
          className="mt-1 self-start rounded-md bg-black px-3 py-1.5 text-sm text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
        >
          {pending ? "Перевіряю..." : "Перевірити"}
        </button>
      ) : (
        <p
          className={`mt-1 text-sm font-medium ${
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

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
