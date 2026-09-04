"use client";

import { useState, type DragEvent } from "react";
import type { ReorderPublic, ReorderDetail } from "@/lib/exercises/types";
import { useExerciseCheck } from "./use-exercise-check";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";
import { SELECTED_OPTION_CLASS } from "./selection-style";
import { pluralizePoints } from "@/lib/pluralize-points";

type SequenceDetail = ReorderDetail["sequences"][number];

// Один ряд плиток у перемішаному порядку — жодного окремого банку чи
// порожніх слотів (на відміну від drag_drop, де банк доречний через текст
// із пропусками). Клік/drag однієї плитки на іншу міняє їх місцями напряму
// в цьому ж ряду. Контрольований компонент — батько (ReorderExercise) тримає
// поточний порядок кожної послідовності, тут лише локальний UI-стан
// (виділення/drag-hover), непотрібний при сабміті.
function ReorderSequenceTiles({
  order,
  onChange,
  detail,
  locked,
  points,
  pointsVisible,
}: {
  order: string[];
  onChange: (next: string[]) => void;
  detail?: SequenceDetail;
  locked: boolean;
  points: number;
  pointsVisible: boolean;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  function swap(i: number, j: number) {
    if (locked || i === j) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  function clickTile(i: number) {
    if (locked) return;
    if (selected === null) {
      setSelected(i);
    } else if (selected === i) {
      setSelected(null);
    } else {
      swap(selected, i);
      setSelected(null);
    }
  }

  function tileClass(i: number, text: string) {
    if (detail) {
      const match = detail.items.find((x) => x.text === text && x.studentIndex === i);
      return match?.isCorrect
        ? "border-green-500 bg-green-50 dark:bg-green-950/30"
        : "border-red-500 bg-red-50 dark:bg-red-950/30";
    }
    if (selected === i) {
      return SELECTED_OPTION_CLASS;
    }
    if (dragOverIndex === i) {
      return "border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/30";
    }
    return "hover:bg-neutral-50 dark:hover:bg-neutral-800";
  }

  // До перевірки — лише якщо pointsVisible; після — завжди. Бали
  // послідовності зараховуються, лише якщо ВСЯ вона правильна (не по
  // окремій плитці, як score) — 0/points, а не часткове.
  const sequenceCorrect = detail?.items.every((i) => i.isCorrect) ?? false;

  return (
    <div>
      {(pointsVisible || detail) && (
        <p className="mb-1 text-xs italic text-neutral-500 dark:text-neutral-400">
          {detail
            ? `${sequenceCorrect ? points : 0}/${points} ${pluralizePoints(points)}`
            : `${points} ${pluralizePoints(points)}`}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {order.map((text, i) => (
          <button
            key={i}
            type="button"
            draggable={!locked}
            onDragStart={(e: DragEvent) => e.dataTransfer.setData("text/plain", String(i))}
            onDragOver={(e: DragEvent) => e.preventDefault()}
            onDragEnter={(e: DragEvent) => {
              e.preventDefault();
              setDragOverIndex(i);
            }}
            onDragLeave={() => setDragOverIndex((prev) => (prev === i ? null : prev))}
            onDragEnd={() => setDragOverIndex(null)}
            onDrop={(e: DragEvent) => {
              e.preventDefault();
              setDragOverIndex(null);
              const from = Number(e.dataTransfer.getData("text/plain"));
              if (!Number.isNaN(from)) swap(from, i);
            }}
            onClick={() => clickTile(i)}
            disabled={locked}
            className={`cursor-grab select-none rounded-md border px-3 py-1.5 text-sm active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-70 ${tileClass(i, text)}`}
          >
            {text}
          </button>
        ))}
      </div>

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
}: {
  taskId: string;
  config: ReorderPublic;
  pointsVisible: boolean;
}) {
  const [orders, setOrders] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(config.sequences.map((s) => [s.id, s.items]))
  );
  const { submit, pending, result, error } = useExerciseCheck(taskId);
  const detail = result?.detail as ReorderDetail | undefined;
  const locked = !!result;

  return (
    <div>
      <p className="mb-2 font-medium">{config.instructions ?? DEFAULT_INSTRUCTIONS.reorder}</p>

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
