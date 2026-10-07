"use client";

import { useState, useEffect } from "react";
import type { TrueFalsePublic, TrueFalseDetail, GradeResult } from "@/lib/exercises/types";
import { useExerciseCheck } from "./use-exercise-check";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";
import { SELECTED_OPTION_CLASS } from "./selection-style";
import { pluralizePoints } from "@/lib/pluralize-points";
import { InstructionsText } from "./instructions-text";
import { ANSWER_CARD_DEFAULT, ITEM_NUMBER_BADGE } from "./answer-card-style";
import { frenchNbsp } from "@/lib/text/french-typography";
import { STUDENT_BUTTON_PRIMARY } from "@/lib/button-styles";
import { EXERCISE_STACK, EXERCISE_BODY_ITEMS_GAP } from "@/lib/spacing";
import { RESULT_MESSAGE_CLASS, SCORE_LABEL_CLASS } from "./score-style";

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
    <div className={EXERCISE_STACK}>
      <InstructionsText
        text={config.instructions ?? DEFAULT_INSTRUCTIONS.true_false.instruction}
        subText={config.subInstructions ?? DEFAULT_INSTRUCTIONS.true_false.subInstruction}
      />
      <div className={`flex flex-col ${EXERCISE_BODY_ITEMS_GAP}`}>
      {config.statements.map((s, index) => {
        const d = detail?.statements.find((x) => x.id === s.id);
        return (
          <div
            key={s.id}
            className="flex items-center justify-between gap-3 rounded-md border border-gray-100 bg-white px-4 py-2.5 shadow-sm md:px-5 md:py-3 dark:border-neutral-700 dark:bg-neutral-800"
          >
            <div className="flex min-w-0 flex-1 items-start gap-2.5">
              {config.statements.length > 1 && (
                <span className={ITEM_NUMBER_BADGE} aria-hidden="true">
                  {index + 1}
                </span>
              )}
              <span className="min-w-0">
                {frenchNbsp(s.text)}
                {/* До перевірки — лише якщо pointsVisible; після — завжди,
                    ваше підтверджене рішення. */}
                {!hidePoints && (pointsVisible || d) && (
                  <span className={`ml-2 ${SCORE_LABEL_CLASS}`}>
                    {d
                      ? `${d.isCorrect ? d.points : 0}/${d.points} ${pluralizePoints(d.points)}`
                      : `${s.points} ${pluralizePoints(s.points)}`}
                  </span>
                )}
              </span>
            </div>
            <div className="flex shrink-0 gap-2">
              {[true, false].map((val) => (
                <button
                  key={String(val)}
                  type="button"
                  disabled={!!result}
                  onClick={() => setAnswers((prev) => ({ ...prev, [s.id]: val }))}
                  className={`min-w-[4.5rem] rounded-lg border px-4 py-1.5 text-center text-base shadow-sm transition-colors ${
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
      </div>

      <div className="flex flex-col gap-3">
        {!result ? (
          <button
            type="button"
            onClick={() =>
              submit(config.statements.map((s) => ({ id: s.id, value: answers[s.id] })))
            }
            disabled={pending || !allAnswered}
            className={`self-start ${STUDENT_BUTTON_PRIMARY}`}
          >
            {pending ? "Перевіряю..." : "Перевірити"}
          </button>
        ) : (
          <p
            className={`${RESULT_MESSAGE_CLASS} ${
              result.correct ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
            }`}
          >
            {result.correct ? "Правильно! ✓" : `Результат: ${result.score}%`}
            {result.pointsPossible !== undefined && (
              <span className={`ml-2 ${SCORE_LABEL_CLASS}`}>
                ({result.pointsEarned} з {result.pointsPossible} {pluralizePoints(result.pointsPossible)})
              </span>
            )}
          </p>
        )}
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>
    </div>
  );
}
