"use client";

import { useState, useEffect, useId } from "react";
import { Check, X } from "lucide-react";
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
import { frenchNbsp } from "@/lib/text/french-typography";
import { STUDENT_BUTTON_PRIMARY } from "@/lib/button-styles";
import { EXERCISE_STACK } from "@/lib/spacing";
import { RESULT_MESSAGE_CLASS, SCORE_LABEL_CLASS } from "./score-style";

// Картка-грід — одна розкладка для обох ширин (раніше "table"/"matrix",
// pickLayout, checkbox-grid-layout.ts — видалено). overflow-clip (НЕ
// overflow-hidden): на телефоні шапка липка (sticky top-0) усередині цієї
// самої картки — sticky рахує "containing block" від найближчого предка з
// overflow інакшим за visible/clip, тож overflow-hidden тут зламав би
// прилипання шапки до сторінки; overflow-clip все одно зрізає кути картки
// під rounded-xl, просто не створює новий скрол-контейнер.
const GRID_TABLE_CARD =
  "w-full max-w-[60rem] overflow-clip rounded-xl border border-gray-200 bg-white dark:border-neutral-700 dark:bg-neutral-800";

// Вертикальна риска після першої колонки (твердження) — лише на md+, де
// твердження справді стоїть окремою колонкою зліва від чекбоксів; на
// телефоні твердження — банер на всю ширину (col-span-full), риска справа
// від нього була би не межею колонки, а довільною лінією під текстом.
const GRID_FIRST_COL_DIVIDER = "md:border-r md:border-gray-200 md:dark:border-neutral-700";

// Обгортка-лейбл клітинки з чекбоксом — min-h-14 (56px) мобільна/md:min-h-16
// (64px): хіт-зона (мінімум 44px із задачі) з запасом під новий 30px-чекбокс
// на md+.
const GRID_CELL_LABEL = "flex min-h-14 w-full items-center justify-center md:min-h-16";

// Сам квадрат чекбокса — нативний <input type="checkbox"> лишається
// sr-only + peer, видимий квадрат — сусідній <span> (стан рахується в JS,
// answers-set, а не CSS :checked — той самий принцип, що в
// imageCardClass/imageOptionIndicator, multiple-choice.tsx). border-2 з
// явним токеном кольору (Tailwind v4: bare "border" резолвиться в
// currentColor).
const GRID_CHECKBOX_BOX =
  "flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md border-2 transition-colors md:h-[30px] md:w-[30px] peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500 peer-focus-visible:ring-offset-1 peer-disabled:opacity-60";
const GRID_CHECKBOX_UNCHECKED = "border-neutral-300 bg-white dark:border-neutral-500 dark:bg-neutral-800";
const GRID_CHECKBOX_CHECKED = "border-brand bg-brand";
// Білий чекмарк — лише для ДО-перевірочного "позначено" стану (квадрат
// суцільно залитий кольором бренду, текст на ньому має бути світлим).
const GRID_CHECKBOX_ICON_ON_BRAND = "h-3.5 w-3.5 text-white md:h-4 md:w-4";

// Позначки результату після "Перевірити" (замість колишнього фону комірки
// bg-green-50/bg-red-50): 4 стани, розрізнені і кольором, і значком, і
// типом лінії рамки (суцільна/пунктирна) — не лише кольором.
const GRID_MARK_CORRECT = "border-green-600 bg-green-50 dark:border-green-500 dark:bg-green-950/30";
const GRID_MARK_WRONG = "border-red-600 bg-red-50 dark:border-red-500 dark:bg-red-950/30";
const GRID_MARK_MISSED = "border-dashed border-green-600 bg-white dark:border-green-500 dark:bg-neutral-800";
const RESULT_ICON_CORRECT = "h-3.5 w-3.5 text-green-700 dark:text-green-400 md:h-4 md:w-4";
const RESULT_ICON_WRONG = "h-3.5 w-3.5 text-red-700 dark:text-red-400 md:h-4 md:w-4";

// Маленький квадрат-зразок у легенді під таблицею — та сама форма, що й
// справжній чекбокс (rounded-md border-2), але фіксованого дрібного
// розміру (легенда не чекбокс, не клікабельна).
const LEGEND_SQUARE = "flex h-4 w-4 shrink-0 items-center justify-center rounded-md border-2";
const LEGEND_ICON_CORRECT = "h-2.5 w-2.5 text-green-700 dark:text-green-400";
const LEGEND_ICON_WRONG = "h-2.5 w-2.5 text-red-700 dark:text-red-400";

// Бал рядка під твердженням — дрібніше й приглушеніше за SCORE_LABEL_CLASS
// (той лишається для підсумкового рядка "Результат: X%", тут навмисно
// локальний text-xs, задача просить саме його, не спільну константу).
const ROW_POINTS_LABEL_CLASS = "text-xs text-neutral-500 dark:text-neutral-400";

// Український дробовий запис балів (крок 0.5 і дробові частки часткового
// заліку) — через кому, однією десятковою: "0,5", не "0.5".
function formatPointsValue(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ",");
}

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

  // Частковий залік за рядком (формула з grade.ts — earnedPoints уже
  // прийшов рахованим із сервера, тут лише форматування підпису).
  function rowPointsLabel(row: CheckboxGridPublic["rows"][number]) {
    if (hidePoints) return null;
    const rowCell = detail?.cells.find((c) => c.rowId === row.id);
    if (!pointsVisible && !rowCell) return null;
    if (rowCell) {
      return `${formatPointsValue(rowCell.earnedPoints)}/${formatPointsValue(row.points)} ${pluralizePoints(row.points)}`;
    }
    return `${formatPointsValue(row.points)} ${pluralizePoints(row.points)}`;
  }

  // Спільний для всіх клітинок грід — малює чекбокс-квадрат і визначає,
  // яку з 4 позначок результату показати після "Перевірити". descId —
  // прихований текст стану для читалки (aria-describedby), окремий від
  // aria-labelledby (назва колонки + твердження).
  function renderCheckboxControl(rowId: string, columnId: string, labelledBy: string, descId: string) {
    const checked = answers[rowId]?.has(columnId) ?? false;
    const cell = detail?.cells.find((c) => c.rowId === rowId && c.columnId === columnId);

    let boxClass = checked ? GRID_CHECKBOX_CHECKED : GRID_CHECKBOX_UNCHECKED;
    let icon: React.ReactNode = checked ? (
      <Check strokeWidth={3} className={GRID_CHECKBOX_ICON_ON_BRAND} />
    ) : null;
    let stateText = "";

    if (cell) {
      if (cell.studentChecked && cell.correctChecked) {
        boxClass = GRID_MARK_CORRECT;
        icon = <Check strokeWidth={3} className={RESULT_ICON_CORRECT} />;
        stateText = "правильно";
      } else if (cell.studentChecked && !cell.correctChecked) {
        boxClass = GRID_MARK_WRONG;
        icon = <X strokeWidth={3} className={RESULT_ICON_WRONG} />;
        stateText = "помилково";
      } else if (!cell.studentChecked && cell.correctChecked) {
        boxClass = GRID_MARK_MISSED;
        icon = <Check strokeWidth={3} className={RESULT_ICON_CORRECT} />;
        stateText = "правильна відповідь, не позначена";
      } else {
        boxClass = GRID_CHECKBOX_UNCHECKED;
        icon = null;
      }
    }

    return (
      <label className={GRID_CELL_LABEL}>
        <input
          type="checkbox"
          className="peer sr-only"
          aria-labelledby={labelledBy}
          aria-describedby={stateText ? descId : undefined}
          checked={checked}
          onChange={() => toggleCell(rowId, columnId)}
          disabled={!!result}
        />
        {stateText && (
          <span id={descId} className="sr-only">
            {stateText}
          </span>
        )}
        <span aria-hidden="true" className={`${GRID_CHECKBOX_BOX} ${boxClass}`}>
          {icon}
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

  // Одна розкладка на всіх ширинах: CSS grid, твердження — перша широка
  // колонка на md+ (col-span-1), на телефоні — банер на всю ширину
  // (col-span-full), далі N колонок чекбоксів. --cb-cols (кількість колонок)
  // — CSS-змінна: Tailwind не вміє repeat(N,...) статичною утилітою для
  // динамічного N, var() у довільному значенні класу читає її в обох
  // медіа-розкладках без дублювання дерева.
  function renderGrid() {
    const columns = config.columns;
    const manyColumns = columns.length > 6;
    const mobileColTemplate = manyColumns
      ? "grid-cols-[repeat(var(--cb-cols),minmax(2.75rem,1fr))]"
      : "grid-cols-[repeat(var(--cb-cols),minmax(0,1fr))]";
    const headerTextSize = manyColumns ? "text-[10px]" : "text-[11px]";

    return (
      <div
        role="table"
        style={{ "--cb-cols": columns.length } as React.CSSProperties}
        className={`grid ${mobileColTemplate} md:grid-cols-[minmax(12rem,2.4fr)_repeat(var(--cb-cols),minmax(4.5rem,1fr))] ${GRID_TABLE_CARD}`}
      >
        <div role="row" className="contents">
          {/* Порожній заповнювач над колонкою твердження — лише на md+,
              де ця колонка реально існує; на телефоні твердження — банер,
              не колонка, заповнювач там не потрібен і схований. */}
          <div
            aria-hidden="true"
            className={`hidden border-b border-gray-200 bg-white dark:border-neutral-700 dark:bg-neutral-800 md:block ${GRID_FIRST_COL_DIVIDER}`}
          />
          {columns.map((c) => (
            <div
              key={c.id}
              id={`${uid}col-${c.id}`}
              role="columnheader"
              className={`sticky top-0 z-10 border-b border-gray-200 bg-white px-1.5 py-2 text-center font-medium leading-tight break-words text-neutral-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400 md:static md:text-sm ${headerTextSize}`}
            >
              {c.label}
            </div>
          ))}
        </div>

        {config.rows.map((row, index) => {
          const stmtId = `${uid}stmt-${row.id}`;
          const rowDivider = index > 0 ? "border-t border-gray-100 dark:border-neutral-800" : "";
          const pointsLabel = rowPointsLabel(row);
          return (
            <div role="row" key={row.id} className="contents">
              <div
                role="rowheader"
                id={stmtId}
                className={`col-span-full flex flex-col gap-0.5 px-2.5 py-2 md:col-span-1 md:min-h-16 md:justify-center ${rowDivider} ${GRID_FIRST_COL_DIVIDER}`}
              >
                <span className="min-w-0 break-words text-sm leading-snug md:text-base">
                  {frenchNbsp(row.label)}
                </span>
                {pointsLabel && <span className={ROW_POINTS_LABEL_CLASS}>{pointsLabel}</span>}
              </div>
              {columns.map((c) => {
                const colId = `${uid}col-${c.id}`;
                const descId = `${uid}desc-${row.id}-${c.id}`;
                return (
                  <div key={c.id} role="gridcell" className={`flex items-center justify-center ${rowDivider}`}>
                    {renderCheckboxControl(row.id, c.id, `${colId} ${stmtId}`, descId)}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className={EXERCISE_STACK}>
      <InstructionsText
        text={config.instructions ?? DEFAULT_INSTRUCTIONS.checkbox_grid.instruction}
        subText={config.subInstructions ?? DEFAULT_INSTRUCTIONS.checkbox_grid.subInstruction}
      />

      {renderGrid()}

      {/* Легенда позначок — лише після "Перевірити", один раз під таблицею. */}
      {detail && (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-neutral-500 dark:text-neutral-400">
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true" className={`${LEGEND_SQUARE} ${GRID_MARK_CORRECT}`}>
              <Check strokeWidth={3} className={LEGEND_ICON_CORRECT} />
            </span>
            правильно
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true" className={`${LEGEND_SQUARE} ${GRID_MARK_WRONG}`}>
              <X strokeWidth={3} className={LEGEND_ICON_WRONG} />
            </span>
            позначено помилково
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true" className={`${LEGEND_SQUARE} ${GRID_MARK_MISSED}`}>
              <Check strokeWidth={3} className={LEGEND_ICON_CORRECT} />
            </span>
            правильна відповідь, яку ви пропустили
          </span>
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
