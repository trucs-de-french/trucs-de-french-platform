"use client";

import { useState, useEffect } from "react";
import type {
  ChronologicalOrderPublic,
  ChronologicalOrderDetail,
  ChronologicalOrderAnswer,
  GradeResult,
} from "@/lib/exercises/types";
import { ImageOrPlaceholder } from "@/components/image-or-placeholder";
import { useExerciseCheck } from "./use-exercise-check";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";
import { pluralizePoints } from "@/lib/pluralize-points";
import { InstructionsText } from "./instructions-text";
import { ANSWER_CARD_BASE, ANSWER_CARD_DEFAULT } from "./answer-card-style";
import { STUDENT_BUTTON_PRIMARY } from "@/lib/button-styles";
import { EXERCISE_STACK, EXERCISE_BODY_ITEMS_GAP } from "@/lib/spacing";

// Мітка показу (A, B, C...) рахується на льоту з індексу вже перемішаного
// config.items — публічний тип свідомо не зберігає її окремо (див.
// ChronologicalOrderPublic у types.ts). Після Z переходить на AA, AB... —
// той самий принцип, що назви колонок у таблиці, про всяк випадок для
// вправ з >26 елементами (малоймовірно, але дешево покрити).
function indexToLabel(index: number): string {
  let n = index;
  let label = "";
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
}

export function ChronologicalOrderExercise({
  taskId,
  config,
  pointsVisible,
  onResult,
  hidePoints,
}: {
  taskId: string;
  config: ChronologicalOrderPublic;
  pointsVisible: boolean;
  onResult?: (result: GradeResult) => void;
  hidePoints?: boolean;
}) {
  const [positions, setPositions] = useState<Record<string, string>>({});
  const { submit, pending, result, error } = useExerciseCheck(taskId);
  const detail = result?.detail as ChronologicalOrderDetail | undefined;

  useEffect(() => {
    if (result) onResult?.(result);
  }, [result, onResult]);

  function updatePosition(itemId: string, value: string) {
    setPositions((prev) => ({ ...prev, [itemId]: value }));
  }

  function itemDetail(itemId: string) {
    return detail?.items.find((i) => i.id === itemId);
  }

  function inputClass(itemId: string) {
    const d = itemDetail(itemId);
    if (!d) return "border-gray-300 dark:border-neutral-600";
    return d.isCorrect
      ? "border-green-500 bg-green-50 dark:bg-green-950/30"
      : "border-red-500 bg-red-50 dark:bg-red-950/30";
  }

  function pointsLabel(itemId: string, points: number) {
    if (hidePoints) return null;
    const d = itemDetail(itemId);
    if (!pointsVisible && !d) return null;
    if (d) {
      return `${d.isCorrect ? points : 0}/${points} ${pluralizePoints(points)}`;
    }
    return `${points} ${pluralizePoints(points)}`;
  }

  function handleSubmit() {
    const answer: ChronologicalOrderAnswer = config.items.map((item) => ({
      itemId: item.id,
      position: Number(positions[item.id] ?? ""),
    }));
    submit(answer);
  }

  function numberInput(itemId: string) {
    return (
      <input
        type="number"
        min={1}
        max={config.items.length}
        value={positions[itemId] ?? ""}
        onChange={(e) => updatePosition(itemId, e.target.value)}
        disabled={!!result}
        placeholder="№"
        className={`w-16 rounded border px-2 py-1 text-sm ${inputClass(itemId)}`}
      />
    );
  }

  return (
    <div className={EXERCISE_STACK}>
      <InstructionsText
        text={config.instructions ?? DEFAULT_INSTRUCTIONS.chronological_order}
        subText={config.subInstructions}
      />

      {config.mode === "image" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {config.items.map((item, i) => (
            <div key={item.id} className={`flex flex-col items-center gap-1 ${ANSWER_CARD_BASE} ${ANSWER_CARD_DEFAULT}`}>
              <div className="relative">
                <ImageOrPlaceholder
                  src={item.content}
                  alt=""
                  className="h-24 w-full rounded-md object-cover"
                />
                <span className="absolute left-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-xs font-medium text-white">
                  {indexToLabel(i)}
                </span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                  Situation n°
                </span>
                {numberInput(item.id)}
              </div>
              {!hidePoints && (pointsVisible || itemDetail(item.id)) ? (
                <p className="text-center text-xs italic text-neutral-500 dark:text-neutral-400">
                  {pointsLabel(item.id, item.points)}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <div className={`flex flex-col ${EXERCISE_BODY_ITEMS_GAP}`}>
          {config.items.map((item, i) => (
            <div key={item.id} className={`flex items-center gap-2 ${ANSWER_CARD_BASE} ${ANSWER_CARD_DEFAULT}`}>
              <span className="w-6 text-center text-sm font-medium text-neutral-500 dark:text-neutral-400">
                {indexToLabel(i)}
              </span>
              <span className="flex-1">{item.content}</span>
              {numberInput(item.id)}
              {!hidePoints && (pointsVisible || itemDetail(item.id)) && (
                <span className="w-16 text-right text-xs italic text-neutral-500 dark:text-neutral-400">
                  {pointsLabel(item.id, item.points)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {!result ? (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={pending}
            className={`self-start ${STUDENT_BUTTON_PRIMARY}`}
          >
            {pending ? "Перевіряю..." : "Перевірити"}
          </button>
        ) : (
          <p
            className={`text-sm font-medium ${
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
    </div>
  );
}
