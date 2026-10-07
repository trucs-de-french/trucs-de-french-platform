"use client";

import { useState, useEffect, useId } from "react";
import type {
  CheckboxGridPublic,
  CheckboxGridDetail,
  CheckboxGridAnswer,
  GradeResult,
} from "@/lib/exercises/types";
import { useExerciseCheck } from "./use-exercise-check";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";
import { pluralizePoints } from "@/lib/pluralize-points";
import { InstructionsText } from "./instructions-text";
import { ITEM_NUMBER_BADGE } from "./answer-card-style";
import { frenchNbsp } from "@/lib/text/french-typography";
import { STUDENT_BUTTON_PRIMARY } from "@/lib/button-styles";
import { EXERCISE_STACK } from "@/lib/spacing";
import { RESULT_MESSAGE_CLASS, SCORE_LABEL_CLASS } from "./score-style";
import { pickLayout, type GridLayout } from "./checkbox-grid-layout";

// Менший локальний варіант круглого бейджа-номера — лише для шапки matrix-
// таблиці (вузькі колонки, повний ITEM_NUMBER_BADGE 24px там розпирає
// клітинку). Спільні ITEM_NUMBER_BADGE/ITEM_LETTER_BADGE не чіпати.
const MATRIX_COLUMN_BADGE =
  "mx-auto flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[10px] font-medium text-white";

// Перший стовпець matrix-таблиці (підписи варіантів) — вузький і липкий
// при горизонтальній прокрутці, непрозорий фон, щоб прокручені клітинки не
// просвічували крізь нього.
const MATRIX_FIRST_COL_HEADER =
  "w-[7.5rem] max-w-[40%] px-2.5 py-2 md:w-auto md:min-w-[10rem] md:max-w-[18rem]";
const MATRIX_FIRST_COL_CELL =
  "sticky left-0 z-10 w-[7.5rem] max-w-[40%] break-words border-r border-gray-200 bg-white px-2.5 py-2 text-left text-sm font-normal md:w-auto md:min-w-[10rem] md:max-w-[18rem] md:text-base dark:border-neutral-700 dark:bg-neutral-800";

export function CheckboxGridExercise({
  taskId,
  config,
  pointsVisible,
  onResult,
  hidePoints,
}: {
  taskId: string;
  config: CheckboxGridPublic;
  pointsVisible: boolean;
  onResult?: (result: GradeResult) => void;
  hidePoints?: boolean;
}) {
  const [answers, setAnswers] = useState<Record<string, Set<string>>>({});
  const { submit, pending, result, error } = useExerciseCheck(taskId);
  const detail = result?.detail as CheckboxGridDetail | undefined;
  const uid = useId();

  useEffect(() => {
    if (result) onResult?.(result);
  }, [result, onResult]);

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
    if (hidePoints) return null;
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

  function renderTable(suffix: string) {
    return (
      <div className="overflow-x-auto">
        <table className="w-fit max-w-xl mx-auto border-collapse text-base">
          <thead>
            <tr className="border-b border-gray-200 text-left text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
              <th className="py-1 pr-2 font-medium"></th>
              {config.columns.map((c) => (
                <th
                  key={c.id}
                  id={`${uid}col${suffix}-${c.id}`}
                  scope="col"
                  className="px-2 py-1 text-center text-xs font-medium leading-tight break-words md:text-sm"
                >
                  {c.label}
                </th>
              ))}
              <th className="py-1 pl-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {config.rows.map((row, index) => {
              const stmtId = `${uid}stmt${suffix}-${row.id}`;
              return (
                <tr key={row.id} className="border-b border-gray-200 last:border-0 dark:border-neutral-700">
                  <td className="min-w-0 py-1 pr-2 md:min-w-[14rem]">
                    <div className="flex items-start gap-2">
                      {config.rows.length > 1 && (
                        <span className={ITEM_NUMBER_BADGE} aria-hidden="true">
                          {index + 1}
                        </span>
                      )}
                      <span id={stmtId} className="min-w-0 break-words text-base leading-snug">
                        {frenchNbsp(row.label)}
                      </span>
                    </div>
                  </td>
                  {config.columns.map((c) => {
                    const colId = `${uid}col${suffix}-${c.id}`;
                    return (
                      <td key={c.id} className={`px-2 py-1 text-center ${cellClass(row.id, c.id)}`}>
                        <label className="flex min-h-11 w-full items-center justify-center">
                          <input
                            type="checkbox"
                            aria-labelledby={`${colId} ${stmtId}`}
                            checked={answers[row.id]?.has(c.id) ?? false}
                            onChange={() => toggleCell(row.id, c.id)}
                            disabled={!!result}
                          />
                        </label>
                      </td>
                    );
                  })}
                  <td className={`py-1 pl-2 ${SCORE_LABEL_CLASS}`}>{rowPointsLabel(row)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  function renderMatrix(suffix: string) {
    return (
      <div className="flex flex-col gap-3">
        <ol className="flex flex-col gap-2.5 md:max-w-3xl">
          {config.rows.map((row, index) => {
            const stmtId = `${uid}stmt${suffix}-${row.id}`;
            return (
              <li key={row.id} className="flex items-start gap-2.5">
                {config.rows.length > 1 && (
                  <span className={ITEM_NUMBER_BADGE} aria-hidden="true">
                    {index + 1}
                  </span>
                )}
                <span
                  id={stmtId}
                  className="min-w-0 flex-1 break-words text-base leading-snug [overflow-wrap:anywhere]"
                >
                  {frenchNbsp(row.label)}
                  {rowPointsLabel(row) && (
                    <span className={`ml-2 ${SCORE_LABEL_CLASS}`}>{rowPointsLabel(row)}</span>
                  )}
                </span>
              </li>
            );
          })}
        </ol>

        <div className="overflow-x-auto">
          <table className="w-full overflow-hidden rounded-xl border border-gray-200 bg-white text-base dark:border-neutral-700 dark:bg-neutral-800 md:w-fit md:max-w-full md:mx-auto">
            <thead>
              <tr className="border-b border-gray-200 dark:border-neutral-700">
                <th className={MATRIX_FIRST_COL_HEADER}></th>
                {config.rows.map((row, index) => (
                  <th
                    key={row.id}
                    id={`${uid}col${suffix}-${row.id}`}
                    scope="col"
                    className="w-9 px-1 py-2 text-center md:w-14"
                  >
                    <span className={MATRIX_COLUMN_BADGE} aria-hidden="true">
                      {index + 1}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {config.columns.map((c) => {
                const optId = `${uid}opt${suffix}-${c.id}`;
                return (
                  <tr key={c.id} className="border-t border-gray-200 dark:border-neutral-700">
                    <th id={optId} scope="row" className={MATRIX_FIRST_COL_CELL}>
                      {frenchNbsp(c.label)}
                    </th>
                    {config.rows.map((row) => {
                      const stmtId = `${uid}stmt${suffix}-${row.id}`;
                      return (
                        <td
                          key={row.id}
                          className={`w-9 px-1 py-2 text-center md:w-14 ${cellClass(row.id, c.id)}`}
                        >
                          <label className="flex min-h-12 w-full items-center justify-center">
                            <input
                              type="checkbox"
                              aria-labelledby={`${optId} ${stmtId}`}
                              checked={answers[row.id]?.has(c.id) ?? false}
                              onChange={() => toggleCell(row.id, c.id)}
                              disabled={!!result}
                            />
                          </label>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function renderTree(layout: GridLayout, suffix: string) {
    return layout === "table" ? renderTable(suffix) : renderMatrix(suffix);
  }

  const statementLabels = config.rows.map((r) => r.label);
  const optionLabels = config.columns.map((c) => c.label);
  const layoutMobile = pickLayout(statementLabels, optionLabels, "mobile");
  const layoutDesktop = pickLayout(statementLabels, optionLabels, "desktop");
  const mobileSuffix = layoutMobile === "table" ? "-t" : "-m";
  const desktopSuffix = layoutDesktop === "table" ? "-t" : "-m";

  return (
    <div className={EXERCISE_STACK}>
      <InstructionsText
        text={config.instructions ?? DEFAULT_INSTRUCTIONS.checkbox_grid.instruction}
        subText={config.subInstructions ?? DEFAULT_INSTRUCTIONS.checkbox_grid.subInstruction}
      />

      {layoutMobile === layoutDesktop ? (
        renderTree(layoutMobile, mobileSuffix)
      ) : (
        <>
          <div className="md:hidden">{renderTree(layoutMobile, mobileSuffix)}</div>
          <div className="hidden md:block">{renderTree(layoutDesktop, desktopSuffix)}</div>
        </>
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
