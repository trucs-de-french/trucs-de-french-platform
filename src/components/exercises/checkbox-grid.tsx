"use client";

import { useState } from "react";
import type {
  CheckboxGridPublic,
  CheckboxGridDetail,
  CheckboxGridAnswer,
} from "@/lib/exercises/types";
import { useExerciseCheck } from "./use-exercise-check";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";
import { pluralizePoints } from "@/lib/pluralize-points";
import { InstructionsText } from "./instructions-text";

export function CheckboxGridExercise({
  taskId,
  config,
  pointsVisible,
}: {
  taskId: string;
  config: CheckboxGridPublic;
  pointsVisible: boolean;
}) {
  const [answers, setAnswers] = useState<Record<string, Set<string>>>({});
  const { submit, pending, result, error } = useExerciseCheck(taskId);
  const detail = result?.detail as CheckboxGridDetail | undefined;

  function toggleCell(rowId: string, columnId: string) {
    setAnswers((prev) => {
      const current = new Set(prev[rowId] ?? []);
      if (current.has(columnId)) current.delete(columnId);
      else current.add(columnId);
      return { ...prev, [rowId]: current };
    });
  }

  function cellClass(rowId: string, columnId: string) {
    const cell = detail?.cells.find((c) => c.rowId === rowId && c.columnId === columnId);
    if (!cell) return "";
    return cell.isCorrect ? "bg-green-50 dark:bg-green-950/30" : "bg-red-50 dark:bg-red-950/30";
  }

  // Бали рахуються на рядок (не на клітинку): рядок зараховується цілком,
  // лише якщо ВСІ його клітинки збігаються з очікуваним станом.
  function rowPointsLabel(row: CheckboxGridPublic["rows"][number]) {
    const rowCells = detail?.cells.filter((c) => c.rowId === row.id);
    if (!pointsVisible && !rowCells?.length) return null;

    if (rowCells?.length) {
      const isCorrect = rowCells.every((c) => c.isCorrect);
      return `${isCorrect ? row.points : 0}/${row.points} ${pluralizePoints(row.points)}`;
    }
    return `${row.points} ${pluralizePoints(row.points)}`;
  }

  function handleSubmit() {
    const answer: CheckboxGridAnswer = config.rows.map((row) => ({
      rowId: row.id,
      columnIds: Array.from(answers[row.id] ?? []),
    }));
    submit(answer);
  }

  return (
    <div>
      <InstructionsText
        text={config.instructions ?? DEFAULT_INSTRUCTIONS.checkbox_grid}
        subText={config.subInstructions}
        className="mb-2 font-medium"
      />

      <div className="overflow-x-auto">
        <table className="w-full max-w-xl border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-neutral-500 dark:text-neutral-400">
              <th className="py-1 pr-2 font-medium"></th>
              {config.columns.map((c) => (
                <th key={c.id} className="px-2 py-1 text-center font-medium">
                  {c.label}
                </th>
              ))}
              <th className="py-1 pl-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {config.rows.map((row) => (
              <tr key={row.id} className="border-b last:border-0">
                <td className="py-1 pr-2">{row.label}</td>
                {config.columns.map((c) => (
                  <td key={c.id} className={`px-2 py-1 text-center ${cellClass(row.id, c.id)}`}>
                    <input
                      type="checkbox"
                      checked={answers[row.id]?.has(c.id) ?? false}
                      onChange={() => toggleCell(row.id, c.id)}
                      disabled={!!result}
                    />
                  </td>
                ))}
                <td className="py-1 pl-2 text-xs italic text-neutral-500 dark:text-neutral-400">
                  {rowPointsLabel(row)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!result ? (
        <button
          type="button"
          onClick={handleSubmit}
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
