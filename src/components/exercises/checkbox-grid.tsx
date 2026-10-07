"use client";

import { useState, useEffect, useId } from "react";
import { Check } from "lucide-react";
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
// просвічували крізь нього. 6.5rem (було 7rem, 0a4659d) — 5 тверджень
// (6.5rem=104px + 5×40px=200px → 304px) влазять у робочу ширину ~310px на
// 390px без горизонтальної прокрутки (0a4659d звужував лише до 7rem=312px —
// на ~2px більше за доступні 310px).
const MATRIX_FIRST_COL_HEADER =
  "w-[6.5rem] max-w-[40%] px-2.5 py-2 md:w-auto md:min-w-[10rem] md:max-w-[18rem]";
const MATRIX_FIRST_COL_CELL =
  "sticky left-0 z-10 w-[6.5rem] max-w-[40%] break-words border-r border-gray-200 bg-white px-2.5 py-2 text-left text-sm font-normal md:w-auto md:min-w-[10rem] md:max-w-[18rem] md:text-base dark:border-neutral-700 dark:bg-neutral-800";

// Картка таблиці — та сама обгортка в обох розкладках ("table" і "matrix"):
// раніше лише matrix мала rounded-xl/рамку/фон прямо на <table>, "table"
// була голою (лише горизонтальні лінії рядків) — тепер однаковий клас в
// обох render-функціях нижче.
const GRID_TABLE_CARD =
  "rounded-xl border border-gray-200 bg-white overflow-hidden dark:border-neutral-700 dark:bg-neutral-800";

// Вертикальна риска після першого стовпця — той самий токен кольору, що
// вже на рамці картки й на border-r у MATRIX_FIRST_COL_CELL вище
// (border-gray-200/dark:border-neutral-700, НЕ neutral-200 — щоб обидві
// розкладки лишались на одному токені).
const GRID_FIRST_COL_DIVIDER = "border-r border-gray-200 dark:border-neutral-700";

// Обгортка-лейбл клітинки з чекбоксом — min-h-14 (56px) мобільна/md:min-h-16
// (64px) в обох розкладках: уніфіковано з "table" (було min-h-11=44px) і
// трохи піднято проти "matrix" (було min-h-12=48px без окремого md-кроку),
// щоб новий 30px-чекбокс на md+ (нижче) мав запас, а не впритул. Хіт-зона
// (44px мінімум із задачі) у 56/64 вже з запасом.
const GRID_CELL_LABEL = "flex min-h-14 w-full items-center justify-center md:min-h-16";

// Сам квадрат чекбокса — єдина константа для обох розкладок (раніше це
// був голий <input type="checkbox"> без жодного класу, суто нативний
// розмір/вигляд браузера, непередбачуваний і дрібний для кліку). Нативний
// input лишається (sr-only + peer) — клавіатура/aria/форма не зачеплені;
// видимий квадрат — сусідній <span>, стан (checked/unchecked) рахується в
// JS (answers-set), а не CSS :checked — той самий принцип, що вже в
// imageCardClass/imageOptionIndicator (multiple-choice.tsx). border-2 з
// явним токеном кольору (не currentColor — Tailwind v4 бага без явного
// кольору на bare "border").
const GRID_CHECKBOX_BOX =
  "flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md border-2 transition-colors md:h-[30px] md:w-[30px] peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500 peer-focus-visible:ring-offset-1 peer-disabled:opacity-60";
const GRID_CHECKBOX_UNCHECKED = "border-neutral-300 bg-white dark:border-neutral-500 dark:bg-neutral-800";
const GRID_CHECKBOX_CHECKED = "border-brand bg-brand";
const GRID_CHECKBOX_ICON = "h-3.5 w-3.5 text-white md:h-4 md:w-4";

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

  // Спільний для обох розкладок — єдине місце, що малює чекбокс-квадрат
  // (GRID_CHECKBOX_*) і резервує хіт-зону (GRID_CELL_LABEL), щоб "table" і
  // "matrix" не розходились власними копіями.
  function renderCheckboxControl(rowId: string, columnId: string, labelledBy: string) {
    const checked = answers[rowId]?.has(columnId) ?? false;
    return (
      <label className={GRID_CELL_LABEL}>
        <input
          type="checkbox"
          className="peer sr-only"
          aria-labelledby={labelledBy}
          checked={checked}
          onChange={() => toggleCell(rowId, columnId)}
          disabled={!!result}
        />
        <span
          aria-hidden="true"
          className={`${GRID_CHECKBOX_BOX} ${checked ? GRID_CHECKBOX_CHECKED : GRID_CHECKBOX_UNCHECKED}`}
        >
          {checked && <Check strokeWidth={3} className={GRID_CHECKBOX_ICON} />}
        </span>
      </label>
    );
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
        <table className={`w-fit max-w-xl mx-auto border-collapse text-base ${GRID_TABLE_CARD}`}>
          <thead>
            <tr className="border-b border-gray-200 text-left text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
              <th className={`py-1 pr-2 pl-2.5 font-medium ${GRID_FIRST_COL_DIVIDER}`}></th>
              {config.columns.map((c) => (
                <th
                  key={c.id}
                  id={`${uid}col${suffix}-${c.id}`}
                  scope="col"
                  className="min-w-11 px-2 py-1 text-center text-xs font-medium leading-tight break-words md:min-w-14 md:text-sm"
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
                  <td className={`min-w-0 py-1 pr-2 pl-2.5 md:min-w-[14rem] ${GRID_FIRST_COL_DIVIDER}`}>
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
                      <td
                        key={c.id}
                        className={`min-w-11 px-2 py-1 text-center md:min-w-14 ${cellClass(row.id, c.id)}`}
                      >
                        {renderCheckboxControl(row.id, c.id, `${colId} ${stmtId}`)}
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
          <table className={`w-full text-base md:w-fit md:max-w-full md:mx-auto ${GRID_TABLE_CARD}`}>
            <thead>
              <tr className="border-b border-gray-200 dark:border-neutral-700">
                <th className={`${MATRIX_FIRST_COL_HEADER} ${GRID_FIRST_COL_DIVIDER}`}></th>
                {config.rows.map((row, index) => (
                  <th
                    key={row.id}
                    id={`${uid}col${suffix}-${row.id}`}
                    scope="col"
                    className="w-10 px-1 py-2 text-center md:w-16"
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
                          className={`w-10 px-1 py-2 text-center md:w-16 ${cellClass(row.id, c.id)}`}
                        >
                          {renderCheckboxControl(row.id, c.id, `${optId} ${stmtId}`)}
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
