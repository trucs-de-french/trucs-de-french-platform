"use client";

import { useState, useEffect } from "react";
import type { TrueFalsePublic, TrueFalseDetail, GradeResult } from "@/lib/exercises/types";
import { useExerciseCheck } from "./use-exercise-check";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";
import { SELECTED_OPTION_CLASS } from "./selection-style";
import { pluralizePoints } from "@/lib/pluralize-points";
import { InstructionsText } from "./instructions-text";
import { ANSWER_CARD_BASE, ANSWER_CARD_DEFAULT } from "./answer-card-style";
import { STUDENT_BUTTON_PRIMARY } from "@/lib/button-styles";

export function TrueFalseExercise({
  taskId,
  config,
  pointsVisible,
  onResult,
  hidePoints,
}: {
  taskId: string;
  config: TrueFalsePublic;
  pointsVisible: boolean;
  // Опційний — для блоків (task_group_id), щоб TaskGroupBlock рахував
  // живий підсумок балів усіх задач блоку (режим "сума"). Не впливає на
  // жодну поведінку самої вправи поза блоками.
  onResult?: (result: GradeResult) => void;
  // Опційний — для блоків у режимі "фіксовано", щоб ховати індивідуальний
  // бал задачі безумовно (і до, і після перевірки).
  hidePoints?: boolean;
}) {
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const { submit, pending, result, error } = useExerciseCheck(taskId);
  const detail = result?.detail as TrueFalseDetail | undefined;

  useEffect(() => {
    if (result) onResult?.(result);
  }, [result, onResult]);

  const allAnswered = config.statements.every((s) => answers[s.id] !== undefined);

  return (
    <div className="flex flex-col gap-2">
      <InstructionsText
        text={config.instructions ?? DEFAULT_INSTRUCTIONS.true_false}
        subText={config.subInstructions}
        className="font-medium"
      />
      {config.statements.map((s) => {
        const d = detail?.statements.find((x) => x.id === s.id);
        return (
          <div
            key={s.id}
            className="flex items-center justify-between gap-3 rounded-md border border-gray-100 bg-white p-2 shadow-sm dark:border-neutral-700 dark:bg-neutral-800"
          >
            <span>
              {s.text}
              {/* До перевірки — лише якщо pointsVisible; після — завжди,
                  ваше підтверджене рішення. */}
              {!hidePoints && (pointsVisible || d) && (
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
                  className={`text-xs ${ANSWER_CARD_BASE} ${
                    d
                      ? val === d.correctAnswer
                        ? "border-green-500 bg-green-50 dark:bg-green-950/30"
                        : val === d.studentAnswer
                          ? "border-red-500 bg-red-50 dark:bg-red-950/30"
                          : ANSWER_CARD_DEFAULT
                      : answers[s.id] === val
                        ? SELECTED_OPTION_CLASS
                        : ANSWER_CARD_DEFAULT
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
          className={`mt-1 self-start ${STUDENT_BUTTON_PRIMARY}`}
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
