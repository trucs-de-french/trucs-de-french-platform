"use client";

import { useState } from "react";
import type { MatchingPublic, MatchingDetail } from "@/lib/exercises/types";
import { useExerciseCheck } from "./use-exercise-check";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";
import { SELECTED_OPTION_CLASS } from "./selection-style";
import { pluralizePoints } from "@/lib/pluralize-points";

export function MatchingExercise({
  taskId,
  config,
  pointsVisible,
}: {
  taskId: string;
  config: MatchingPublic;
  pointsVisible: boolean;
}) {
  const [pairs, setPairs] = useState<Record<string, string>>({});
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const { submit, pending, result, error } = useExerciseCheck(taskId);
  const detail = result?.detail as MatchingDetail | undefined;

  const usedRights = new Set(Object.values(pairs));

  function pairedLeftOf(right: string) {
    return Object.entries(pairs).find(([, r]) => r === right)?.[0];
  }

  function clickLeft(left: string) {
    if (result) return;
    if (pairs[left]) {
      setPairs((prev) => {
        const next = { ...prev };
        delete next[left];
        return next;
      });
      setSelectedLeft(null);
      return;
    }
    setSelectedLeft((prev) => (prev === left ? null : left));
  }

  function clickRight(right: string) {
    if (result) return;
    if (selectedLeft) {
      setPairs((prev) => {
        const next = { ...prev };
        const prevLeft = pairedLeftOf(right);
        if (prevLeft) delete next[prevLeft];
        next[selectedLeft] = right;
        return next;
      });
      setSelectedLeft(null);
      return;
    }
    const left = pairedLeftOf(right);
    if (left) {
      setPairs((prev) => {
        const next = { ...prev };
        delete next[left];
        return next;
      });
    }
  }

  function detailFor(left: string, right: string) {
    return detail?.studentPairs.find((p) => p.left === left && p.right === right);
  }

  // До перевірки — лише якщо pointsVisible; після — завжди. left тут НЕ
  // перемішаний (config.pairs у тому самому порядку), тож можна знайти
  // бали цієї пари напряму за текстом лівого елемента.
  function pointsLabel(left: string) {
    const pd = detail?.pairPoints.find((p) => p.left === left);
    const points = config.pairs.find((p) => p.left === left)?.points;
    if (points === undefined) return "";
    if (!pointsVisible && !pd) return "";
    if (pd) return ` (${pd.isCorrect ? pd.points : 0}/${pd.points} ${pluralizePoints(pd.points)})`;
    return ` (${points} ${pluralizePoints(points)})`;
  }

  return (
    <div>
      <p className="mb-2 font-medium">{config.instructions ?? DEFAULT_INSTRUCTIONS.matching}</p>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          {config.left.map((left) => {
            const right = pairs[left];
            const d = right ? detailFor(left, right) : undefined;
            return (
              <button
                key={left}
                type="button"
                onClick={() => clickLeft(left)}
                disabled={!!result}
                className={`rounded-md border px-3 py-1.5 text-left text-sm ${
                  d
                    ? d.isCorrect
                      ? "border-green-500 bg-green-50 dark:bg-green-950/30"
                      : "border-red-500 bg-red-50 dark:bg-red-950/30"
                    : selectedLeft === left
                      ? SELECTED_OPTION_CLASS
                      : right
                        ? "border-blue-400 bg-blue-50 dark:bg-blue-950/30"
                        : "hover:bg-neutral-50 dark:hover:bg-neutral-800"
                }`}
              >
                {left}
                {right ? ` → ${right}` : ""}
                <span className="italic text-neutral-500 dark:text-neutral-400">
                  {pointsLabel(left)}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-1">
          {config.right.map((right) => (
            <button
              key={right}
              type="button"
              onClick={() => clickRight(right)}
              disabled={!!result}
              className={`rounded-md border px-3 py-1.5 text-left text-sm ${
                usedRights.has(right) ? "opacity-50" : "hover:bg-neutral-50 dark:hover:bg-neutral-800"
              }`}
            >
              {right}
            </button>
          ))}
        </div>
      </div>

      {detail && (
        <div className="mt-3 text-sm">
          <p className="font-medium">Правильні пари:</p>
          <ul className="mt-1 flex flex-col gap-0.5 text-neutral-600 dark:text-neutral-400">
            {detail.correctPairs.map((p, i) => (
              <li key={i}>
                {p.left} → {p.right}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!result ? (
        <button
          type="button"
          onClick={() => submit(Object.entries(pairs).map(([left, right]) => ({ left, right })))}
          disabled={pending || Object.keys(pairs).length !== config.left.length}
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
