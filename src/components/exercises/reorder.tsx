"use client";

import { useState, useEffect } from "react";
import type { ReorderPublic, ReorderDetail, GradeResult } from "@/lib/exercises/types";
import { useExerciseCheck } from "./use-exercise-check";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";
import { SwappableTileRow } from "./swappable-tile-row";
import { pluralizePoints } from "@/lib/pluralize-points";
import { InstructionsText } from "./instructions-text";
import { STUDENT_BUTTON_PRIMARY } from "@/lib/button-styles";

type SequenceDetail = ReorderDetail["sequences"][number];

// Один ряд плиток у перемішаному порядку — жодного окремого банку чи
// порожніх слотів (на відміну від drag_drop, де банк доречний через текст
// із пропусками). Сам DnD/click-swap — у спільному SwappableTileRow
// (той самий код, що й letter_rearrangement). Контрольований компонент —
// батько (ReorderExercise) тримає поточний порядок кожної послідовності.
function ReorderSequenceTiles({
  order,
  onChange,
  detail,
  locked,
  points,
  pointsVisible,
  hidePoints,
}: {
  order: string[];
  onChange: (next: string[]) => void;
  detail?: SequenceDetail;
  locked: boolean;
  points: number;
  pointsVisible: boolean;
  hidePoints?: boolean;
}) {
  // detail.items[i].correctIndex === i завжди (масив побудований по
  // позиції) — пряма індексація, не пошук за текстом/studentIndex.
  function tileState(i: number): "correct" | "incorrect" | undefined {
    if (!detail) return undefined;
    return detail.items[i]?.isCorrect ? "correct" : "incorrect";
  }

  // До перевірки — лише якщо pointsVisible; після — завжди. Бали
  // послідовності зараховуються, лише якщо ВСЯ вона правильна (не по
  // окремій плитці, як score) — 0/points, а не часткове.
  const sequenceCorrect = detail?.items.every((i) => i.isCorrect) ?? false;

  return (
    <div>
      {!hidePoints && (pointsVisible || detail) && (
        <p className="mb-1 text-xs italic text-neutral-500 dark:text-neutral-400">
          {detail
            ? `${sequenceCorrect ? points : 0}/${points} ${pluralizePoints(points)}`
            : `${points} ${pluralizePoints(points)}`}
        </p>
      )}
      <SwappableTileRow items={order} onChange={onChange} locked={locked} tileState={tileState} />

      {detail && (
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          Правильний порядок:{" "}
          {[...detail.items]
            .sort((a, b) => a.correctIndex - b.correctIndex)
            .map((i) => i.text)
            .join(" → ")}
        </p>
      )}
    </div>
  );
}

export function ReorderExercise({
  taskId,
  config,
  pointsVisible,
  onResult,
  hidePoints,
}: {
  taskId: string;
  config: ReorderPublic;
  pointsVisible: boolean;
  onResult?: (result: GradeResult) => void;
  hidePoints?: boolean;
}) {
  const [orders, setOrders] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(config.sequences.map((s) => [s.id, s.items]))
  );
  const { submit, pending, result, error } = useExerciseCheck(taskId);
  const detail = result?.detail as ReorderDetail | undefined;
  const locked = !!result;

  useEffect(() => {
    if (result) onResult?.(result);
  }, [result, onResult]);

  return (
    <div>
      <InstructionsText
        text={config.instructions ?? DEFAULT_INSTRUCTIONS.reorder}
        subText={config.subInstructions}
        className="mb-2"
      />

      <div className="flex flex-col gap-4">
        {config.sequences.map((seq) => (
          <ReorderSequenceTiles
            key={seq.id}
            order={orders[seq.id] ?? seq.items}
            onChange={(next) => setOrders((prev) => ({ ...prev, [seq.id]: next }))}
            detail={detail?.sequences.find((d) => d.id === seq.id)}
            locked={locked}
            points={seq.points}
            pointsVisible={pointsVisible}
            hidePoints={hidePoints}
          />
        ))}
      </div>

      {!result ? (
        <button
          type="button"
          onClick={() =>
            submit(config.sequences.map((s) => ({ sequenceId: s.id, order: orders[s.id] ?? [] })))
          }
          disabled={pending}
          className={`mt-3 ${STUDENT_BUTTON_PRIMARY}`}
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
