"use client";

import { useState } from "react";
import type { TableFillPublic, TableFillDetail } from "@/lib/exercises/types";
import { useExerciseCheck } from "./use-exercise-check";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";

function cellKey(rowId: string, side: "left" | "right") {
  return `${rowId}:${side}`;
}

export function TableFillExercise({
  taskId,
  config,
}: {
  taskId: string;
  config: TableFillPublic;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const { submit, pending, result, error } = useExerciseCheck(taskId);
  const detail = result?.detail as TableFillDetail | undefined;

  function updateAnswer(rowId: string, side: "left" | "right", value: string) {
    setAnswers((prev) => ({ ...prev, [cellKey(rowId, side)]: value }));
  }

  function inputClass(rowId: string, side: "left" | "right") {
    if (!detail) return "";
    const blank = detail.blanks.find((b) => b.rowId === rowId && b.side === side);
    if (!blank) return "";
    return blank.isCorrect
      ? "border-green-500 bg-green-50 dark:bg-green-950/30"
      : "border-red-500 bg-red-50 dark:bg-red-950/30";
  }

  function renderCell(rowId: string, side: "left" | "right", value: string | null) {
    if (value !== null) {
      return <span>{value}</span>;
    }
    return (
      <input
        value={answers[cellKey(rowId, side)] ?? ""}
        onChange={(e) => updateAnswer(rowId, side, e.target.value)}
        disabled={!!result}
        className={`w-full rounded border px-2 py-1 text-sm ${inputClass(rowId, side)}`}
      />
    );
  }

  function handleSubmit() {
    const answer = Object.entries(answers).map(([key, value]) => {
      const [rowId, side] = key.split(":") as [string, "left" | "right"];
      return { rowId, side, value };
    });
    submit(answer);
  }

  return (
    <div>
      <p className="mb-2 font-medium">{config.instructions ?? DEFAULT_INSTRUCTIONS.table_fill}</p>

      <div className="overflow-x-auto">
        <table className="w-full max-w-md border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-neutral-500 dark:text-neutral-400">
              <th className="py-1 pr-2 font-medium">{config.columnLabels[0]}</th>
              <th className="py-1 font-medium">{config.columnLabels[1]}</th>
            </tr>
          </thead>
          <tbody>
            {config.rows.map((row) => (
              <tr key={row.id} className="border-b last:border-0">
                <td className="py-1 pr-2">{renderCell(row.id, "left", row.left)}</td>
                <td className="py-1">{renderCell(row.id, "right", row.right)}</td>
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
        </p>
      )}

      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
