"use client";

import { useState, useEffect } from "react";
import type { TableFillPublic, TableFillDetail, GradeResult } from "@/lib/exercises/types";
import { useExerciseCheck } from "./use-exercise-check";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";
import { pluralizePoints } from "@/lib/pluralize-points";
import { InstructionsText } from "./instructions-text";
import { STUDENT_BUTTON_PRIMARY } from "@/lib/button-styles";
import { DiacriticsPopup, useDiacriticsPopup, insertAtCursor, focusAndSetCursor } from "./diacritics-popup";
import { EXERCISE_STACK } from "@/lib/spacing";

function cellKey(rowId: string, side: "left" | "right") {
  return `${rowId}:${side}`;
}

export function TableFillExercise({
  taskId,
  config,
  pointsVisible,
  onResult,
  hidePoints,
}: {
  taskId: string;
  config: TableFillPublic;
  pointsVisible: boolean;
  onResult?: (result: GradeResult) => void;
  hidePoints?: boolean;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const diacritics = useDiacriticsPopup<string>();
  const { submit, pending, result, error } = useExerciseCheck(taskId);
  const detail = result?.detail as TableFillDetail | undefined;

  useEffect(() => {
    if (result) onResult?.(result);
  }, [result, onResult]);

  function updateAnswer(rowId: string, side: "left" | "right", value: string) {
    setAnswers((prev) => ({ ...prev, [cellKey(rowId, side)]: value }));
  }

  function inputClass(rowId: string, side: "left" | "right") {
    const idle = "border-gray-300 dark:border-neutral-600";
    if (!detail) return idle;
    const blank = detail.blanks.find((b) => b.rowId === rowId && b.side === side);
    if (!blank) return idle;
    return blank.isCorrect
      ? "border-green-500 bg-green-50 dark:bg-green-950/30"
      : "border-red-500 bg-red-50 dark:bg-red-950/30";
  }

  // Рядки без жодної прихованої клітинки нема чого оцінювати — бали для них
  // не показуємо взагалі. До перевірки — лише якщо pointsVisible; після —
  // завжди. Бали рядка зараховуються, лише якщо ВСІ його приховані
  // клітинки (1 або 2) правильні — не по клітинці, як score.
  function rowPointsLabel(row: TableFillPublic["rows"][number]) {
    if (hidePoints) return null;
    const hasHidden = row.left === null || row.right === null;
    if (!hasHidden) return null;

    const rowBlanks = detail?.blanks.filter((b) => b.rowId === row.id);
    if (!pointsVisible && !rowBlanks?.length) return null;

    if (rowBlanks?.length) {
      const isCorrect = rowBlanks.every((b) => b.isCorrect);
      return `${isCorrect ? row.points : 0}/${row.points} ${pluralizePoints(row.points)}`;
    }
    return `${row.points} ${pluralizePoints(row.points)}`;
  }

  function renderCell(rowId: string, side: "left" | "right", value: string | null) {
    if (value !== null) {
      return <span>{value}</span>;
    }
    const key = cellKey(rowId, side);
    return (
      <input
        ref={diacritics.fieldRef(key)}
        value={answers[key] ?? ""}
        onChange={(e) => updateAnswer(rowId, side, e.target.value)}
        onFocus={() => diacritics.onFocus(key)}
        onBlur={diacritics.onBlur}
        disabled={!!result}
        className={`w-full rounded border px-2 py-1 text-base ${inputClass(rowId, side)}`}
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
    <div className={EXERCISE_STACK}>
      <InstructionsText
        text={config.instructions ?? DEFAULT_INSTRUCTIONS.table_fill}
        subText={config.subInstructions}
      />

      <div className="overflow-x-auto">
        <table className="w-full max-w-md border-collapse text-base">
          <thead>
            <tr className="border-b border-gray-200 text-left text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
              <th className="py-1 pr-2 font-medium">{config.columnLabels[0]}</th>
              <th className="py-1 pr-2 font-medium">{config.columnLabels[1]}</th>
              <th className="py-1 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {config.rows.map((row) => (
              <tr key={row.id} className="border-b border-gray-200 last:border-0 dark:border-neutral-700">
                <td className="py-1 pr-2">{renderCell(row.id, "left", row.left)}</td>
                <td className="py-1 pr-2">{renderCell(row.id, "right", row.right)}</td>
                <td className="py-1 text-xs italic text-neutral-500 dark:text-neutral-400">
                  {rowPointsLabel(row)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {diacritics.rect && !result && diacritics.activeKey && (
        <DiacriticsPopup
          rect={diacritics.rect}
          onPick={(ch) => {
            const key = diacritics.activeKey!;
            const rowId = key.slice(0, key.lastIndexOf(":"));
            const side = key.slice(key.lastIndexOf(":") + 1) as "left" | "right";
            const el = diacritics.getElement(key);
            const { value, cursor } = insertAtCursor(el, answers[key] ?? "", ch);
            updateAnswer(rowId, side, value);
            focusAndSetCursor(el, cursor);
          }}
        />
      )}

      {/* Той самий патерн, що fill-blank.tsx — список неправильних
          клітинок з правильною відповіддю під таблицею. rowIndex+сторона
          (назва колонки), бо на відміну від fill-blank тут кілька рядків і
          дві можливі приховані клітинки на рядок, самого "Пропуск N" було б
          недостатньо, щоб зрозуміти, про яку клітинку йдеться. */}
      {detail && (
        <ul className="flex flex-col gap-1 text-sm">
          {detail.blanks.map((b, i) =>
            b.isCorrect ? null : (
              <li key={i} className="text-red-600 dark:text-red-400">
                Рядок {config.rows.findIndex((r) => r.id === b.rowId) + 1}, {config.columnLabels[b.side === "left" ? 0 : 1]}: правильно — {b.correctAnswers.join(" / ")}
              </li>
            )
          )}
        </ul>
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
