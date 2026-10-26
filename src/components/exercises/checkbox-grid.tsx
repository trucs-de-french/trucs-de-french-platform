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
import { usePracticeCheck } from "./use-practice-check";
import { WHOLE_TASK_ITEM_ID } from "@/lib/exercises/error-review";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";
import { pluralizePoints } from "@/lib/pluralize-points";
import { TaskPanelHeader } from "./task-panel-header";
import { BlockTabs } from "./block-navigation";
import { frenchNbsp } from "@/lib/text/french-typography";
import { STUDENT_BUTTON_PRIMARY, STUDENT_BUTTON_SECONDARY_TOUCH } from "@/lib/button-styles";
import { EXERCISE_STACK } from "@/lib/spacing";
import { RESULT_MESSAGE_CLASS } from "./score-style";
import { TaskResult, rowPointsTabStatus } from "./task-result";
import { TABLE_FILL_ANSWERS_TOGGLE_LABEL } from "@/lib/exercises/default-task-labels";

// Режим практики "Робота над помилками" (пілот, частина 7, хвиля 3) — той
// самий принцип whole, що ReorderPracticeProps тощо.
export type CheckboxGridPracticeProps = { whole: true; failedAttempts: Record<string, number> };

// Картка-таблиця (md+) — одна гold-рамкована картка з суцільним indigo-
// заголовком колонок-чекбоксів; overflow-hidden (не overflow-clip, як
// раніше) — на відміну від колишньої розкладки, тут уже немає спільної
// сітки з мобільним "банером твердження всередині тієї ж картки" (мобільна
// розкладка тепер окремі картки-твердження нижче, п.6 задачі), тож
// sticky-заголовку всередині картки більше нема що ламати.
const GRID_TABLE_CARD =
  "hidden w-full overflow-hidden rounded-[14px] dark:rounded-xl border-[1.5px] dark:border glass-gold-edge border-[#dcbd6e] bg-white glass-card-shadow dark:shadow-none dark:border-neutral-700 dark:bg-neutral-800 md:block";

// Заголовок колонки-чекбокса — суцільний indigo-градієнт, що чергується
// (світліший/темніший), щоб N сусідніх колонок розрізнялись навіть коли
// підписи короткі.
const GRID_HEADER_CELL_A = "bg-[linear-gradient(180deg,#5a55e6,#3b36c4)]";
const GRID_HEADER_CELL_B = "bg-[linear-gradient(180deg,#4b46da,#2f2c6b)]";

// Смугасті колонки-чекбокси (odd/even) — легка крем-смуга проти суцільно
// білої, щоб довгий рядок читався горизонтально без рамок між клітинками.
const GRID_COL_ODD = "bg-[#fbf6e6] dark:bg-white/[0.04]";
const GRID_COL_EVEN = "bg-white dark:bg-transparent";

// Квадрат-чекбокс таблиці — нативний <input type="checkbox"> лишається
// sr-only + peer, видимий квадрат — сусідній <span> (стан рахується в JS,
// answers-set, а не CSS :checked). border-2 з явним токеном кольору
// (Tailwind v4: bare "border" резолвиться в currentColor).
const GRID_CHECKBOX_BOX =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] border-2 transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#4b46da] peer-disabled:opacity-100";
const GRID_CHECKBOX_UNCHECKED =
  "border-[#e0cf9a] bg-white dark:border-[rgba(243,217,139,0.45)] dark:bg-white/[0.06]";
const GRID_CHECKBOX_CHECKED = "border-[#4b46da] bg-[linear-gradient(135deg,#5a55e6,#3b36c4)]";
const GRID_CHECKBOX_ICON_ON_BRAND = "h-4 w-4 text-white";

// Позначки результату після "Перевірити" — лише 2 стани в самій
// клітинці (студент позначив правильно/помилково); "правильна відповідь,
// яку пропустили" тут НЕ показується (п.5 задачі) — вона йде лише у toggle
// "Правильні відповіді" нижче.
const GRID_MARK_CORRECT =
  "border-[#4cc47e] bg-[#eafaf0] dark:border-[#4cc47e] dark:bg-[rgba(47,158,91,0.28)]";
const GRID_MARK_WRONG =
  "border-[#e5484d] bg-[#fdeeee] dark:border-[rgba(255,140,140,0.45)] dark:bg-[rgba(255,120,120,0.16)]";
const RESULT_ICON_CORRECT = "h-4 w-4 text-[#1f7a3d] dark:text-[#bff0d0]";
const RESULT_ICON_WRONG = "h-4 w-4 text-[#b42318] dark:text-[#ffb4ae]";

// Маленький квадрат-зразок у легенді під таблицею — та сама форма, що й
// справжній чекбокс (rounded border-2), фіксованого дрібного розміру.
const LEGEND_SQUARE = "flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border-2";
const LEGEND_ICON_CORRECT = "h-2.5 w-2.5 text-[#1f7a3d] dark:text-[#bff0d0]";
const LEGEND_ICON_WRONG = "h-2.5 w-2.5 text-[#b42318] dark:text-[#ffb4ae]";

// Мобільна плитка-варіант (<768px, п.6 задачі) — чекбокс + назва колонки,
// увесь фон плитки несе колір стану (не лише внутрішній квадрат).
const TILE_BASE =
  "flex min-h-11 items-center gap-2 rounded-xl border-[1.5px] px-2.5 py-2 text-left transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#4b46da]";
const TILE_UNCHECKED = "border-[#ead9a6] bg-[#faf5e4] dark:border-[rgba(243,217,139,0.25)] dark:bg-white/[0.04]";
const TILE_CHECKED = "border-[#4b46da] bg-[linear-gradient(135deg,#5a55e6,#3b36c4)] text-white";
const TILE_CORRECT = "border-[#4cc47e] bg-[#eafaf0] dark:border-[#4cc47e] dark:bg-[rgba(47,158,91,0.28)]";
const TILE_WRONG = "border-[#e5484d] bg-[#fdeeee] dark:border-[rgba(255,140,140,0.45)] dark:bg-[rgba(255,120,120,0.16)]";
const TILE_INDICATOR_BASE =
  "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border-2";

// Український дробовий запис балів (крок 0.5 і дробові частки часткового
// заліку) — через кому, однією десятковою: "0,5", не "0.5".
function formatPointsValue(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ",");
}

export function CheckboxGridExercise({
  taskId,
  config,
  plaqueText,
  pointsVisible,
  onResult,
  hidePoints,
  practice,
}: {
  taskId: string;
  config: CheckboxGridPublic;
  plaqueText?: string;
  pointsVisible: boolean;
  onResult?: (result: GradeResult) => void;
  hidePoints?: boolean;
  practice?: CheckboxGridPracticeProps;
}) {
  const [answers, setAnswers] = useState<Record<string, Set<string>>>({});
  const { submit, pending, result, error } = useExerciseCheck(taskId);
  const singleDetail = result?.detail as CheckboxGridDetail | undefined;
  const uid = useId();

  // ==== Гілка практики (whole, частина 7, хвиля 3) — ЦІЛЕ завдання як один
  // елемент (WHOLE_TASK_ITEM_ID), той самий принцип, що інші whole-типи.
  const isPractice = !!practice;
  const practiceCheck = usePracticeCheck(taskId);
  const [practiceDetail, setPracticeDetail] = useState<CheckboxGridDetail | undefined>(undefined);
  const [practiceCorrect, setPracticeCorrect] = useState(false);
  const [practiceFailedAttempts, setPracticeFailedAttempts] = useState<Record<string, number>>(
    practice?.failedAttempts ?? {}
  );

  // У практиці грід НЕ показує по-клітинкові кольори (на відміну від
  // звичайного проходження) — лише загальне правильно/неправильно і
  // гейтована повна відповідь (reveal), той самий принцип, що придушення
  // "правильна колонка" в sort-columns.tsx: інакше колір клітинки зраджував
  // би правильність одразу на кожен "Перевірити", без очікування 2 невдач/
  // кнопки.
  const detail = isPractice ? undefined : singleDetail;
  const locked = isPractice ? practiceCorrect : !!result;

  useEffect(() => {
    if (!isPractice && result) onResult?.(result);
  }, [isPractice, result, onResult]);

  async function submitPractice() {
    const answer: CheckboxGridAnswer = config.rows.map((row) => ({
      rowId: row.id,
      columnIds: Array.from(answers[row.id] ?? []),
    }));
    const r = await practiceCheck.check([WHOLE_TASK_ITEM_ID], answer);
    if (!r) return;
    const correct = r.results[0]?.correct ?? false;
    setPracticeCorrect(correct);
    setPracticeDetail(r.detail as CheckboxGridDetail | undefined);
    setPracticeFailedAttempts(r.failedAttempts);
    const attempts = r.failedAttempts[WHOLE_TASK_ITEM_ID] ?? 0;
    if (!correct && attempts >= 2 && !practiceCheck.revealed[WHOLE_TASK_ITEM_ID]) {
      practiceCheck.reveal(WHOLE_TASK_ITEM_ID, false);
    }
  }

  function toggleCell(rowId: string, columnId: string) {
    setAnswers((prev) => {
      const current = new Set(prev[rowId] ?? []);
      if (current.has(columnId)) current.delete(columnId);
      else current.add(columnId);
      return { ...prev, [rowId]: current };
    });
  }

  // Компактна лавандова вкладка балів рядка — той самий вигляд
  // (.row-points-tab/--correct/--partial/--wrong), що RowPointsTab
  // (task-result.tsx). У табличній розкладці — статична (рядок-клітинка),
  // у мобільній картці — абсолютна на верхній рамці картки (RowPointsTab-
  // патерн, той самий, що table-fill.tsx: .row-points-tab-wrap + звичайний
  // <span className="row-points-tab">).
  function rowPointsTab(row: CheckboxGridPublic["rows"][number], absolute: boolean) {
    if (hidePoints) return null;
    const rowCell = detail?.cells.find((c) => c.rowId === row.id);
    if (!pointsVisible && !rowCell) return null;
    const style = absolute ? undefined : { position: "static" as const };
    if (!rowCell) {
      return (
        <span className="row-points-tab" style={style}>
          {formatPointsValue(row.points)} {pluralizePoints(row.points)}
        </span>
      );
    }
    const status = rowPointsTabStatus(rowCell.earnedPoints, row.points);
    return (
      <span className={`row-points-tab row-points-tab--${status}`} style={style}>
        {status === "correct" && <Check strokeWidth={3} className="h-3 w-3" />}
        {status === "wrong" && <X strokeWidth={3} className="h-3 w-3" />}
        {formatPointsValue(rowCell.earnedPoints)} з {formatPointsValue(row.points)}
      </span>
    );
  }

  // Спільний для десктоп-таблиці квадрат-чекбокс — малює лише сам квадрат,
  // розкладка-клітинка довкола лишається у renderGrid(). descId —
  // прихований текст стану для читалки (aria-describedby), окремий від
  // aria-labelledby (назва колонки + твердження).
  function renderCheckboxControl(rowId: string, columnId: string, labelledBy: string, descId: string) {
    const checked = answers[rowId]?.has(columnId) ?? false;
    const cell = detail?.cells.find((c) => c.rowId === rowId && c.columnId === columnId);

    let boxClass = checked ? GRID_CHECKBOX_CHECKED : GRID_CHECKBOX_UNCHECKED;
    let icon: React.ReactNode = checked ? (
      <Check strokeWidth={3.6} className={GRID_CHECKBOX_ICON_ON_BRAND} />
    ) : null;
    let stateText = "";

    if (cell) {
      if (cell.studentChecked && cell.correctChecked) {
        boxClass = GRID_MARK_CORRECT;
        icon = <Check strokeWidth={3.6} className={RESULT_ICON_CORRECT} />;
        stateText = "правильно";
      } else if (cell.studentChecked && !cell.correctChecked) {
        boxClass = GRID_MARK_WRONG;
        icon = <X strokeWidth={3.6} className={RESULT_ICON_WRONG} />;
        stateText = "помилково";
      } else {
        boxClass = GRID_CHECKBOX_UNCHECKED;
        icon = null;
      }
    }

    return (
      <label className="flex min-h-11 w-full min-w-11 items-center justify-center">
        <input
          type="checkbox"
          className="peer sr-only"
          aria-labelledby={labelledBy}
          aria-describedby={stateText ? descId : undefined}
          checked={checked}
          onChange={() => toggleCell(rowId, columnId)}
          disabled={locked}
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

  // Мобільна плитка (<768px) — вся плитка несе колір стану (не лише
  // внутрішній індикатор), п.6 задачі.
  function renderOptionTile(row: CheckboxGridPublic["rows"][number], col: CheckboxGridPublic["columns"][number]) {
    const checked = answers[row.id]?.has(col.id) ?? false;
    const cell = detail?.cells.find((c) => c.rowId === row.id && c.columnId === col.id);

    let tileClass = checked ? TILE_CHECKED : TILE_UNCHECKED;
    let indicatorClass = "border-[#c9b67a] bg-transparent";
    let icon: React.ReactNode = null;
    let stateText = "";

    if (checked && !cell) {
      indicatorClass = "border-white bg-white/25";
      icon = <Check strokeWidth={3.6} className="h-3 w-3 text-white" />;
    }
    if (cell) {
      if (cell.studentChecked && cell.correctChecked) {
        tileClass = TILE_CORRECT;
        indicatorClass = "border-[#1f7a3d] bg-white/70 dark:border-[#bff0d0] dark:bg-white/10";
        icon = <Check strokeWidth={3.6} className="h-3 w-3 text-[#1f7a3d] dark:text-[#bff0d0]" />;
        stateText = "правильно";
      } else if (cell.studentChecked && !cell.correctChecked) {
        tileClass = TILE_WRONG;
        indicatorClass = "border-[#b42318] bg-white/70 dark:border-[#ffb4ae] dark:bg-white/10";
        icon = <X strokeWidth={3.6} className="h-3 w-3 text-[#b42318] dark:text-[#ffb4ae]" />;
        stateText = "помилково";
      } else {
        tileClass = TILE_UNCHECKED;
        indicatorClass = "border-[#c9b67a] bg-transparent";
        icon = null;
      }
    }

    const descId = `${uid}desc-tile-${row.id}-${col.id}`;

    return (
      <label key={col.id} className={`${TILE_BASE} ${tileClass} ${locked ? "" : "cursor-pointer"}`}>
        <input
          type="checkbox"
          className="sr-only"
          aria-label={`${row.label} — ${col.label}`}
          aria-describedby={stateText ? descId : undefined}
          checked={checked}
          onChange={() => toggleCell(row.id, col.id)}
          disabled={locked}
        />
        {stateText && (
          <span id={descId} className="sr-only">
            {stateText}
          </span>
        )}
        <span aria-hidden="true" className={`${TILE_INDICATOR_BASE} ${indicatorClass}`}>
          {icon}
        </span>
        <span className="min-w-0 flex-1 break-words font-content text-sm leading-snug">{col.label}</span>
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

  // Десктоп-таблиця (md+, п.1-5 задачі): statement-колонка 1fr, далі N
  // колонок по 84px — одна фіксована ширина чекбокс-колонки, незалежно від
  // довжини підпису (п.1 задачі: "84px column per option").
  function renderDesktopTable() {
    const columns = config.columns;
    return (
      <div
        role="table"
        style={{ "--cb-cols": columns.length } as React.CSSProperties}
        className={`grid grid-cols-[minmax(12rem,1fr)_repeat(var(--cb-cols),84px)] ${GRID_TABLE_CARD}`}
      >
        <div role="row" className="contents">
          {/* Клітинка над колонкою твердження — порожня, фон картки (п.2
              задачі: "statement-column header cell is empty"). */}
          <div aria-hidden="true" className="bg-white dark:bg-neutral-800" />
          {columns.map((c, i) => (
            <div
              key={c.id}
              id={`${uid}col-${c.id}`}
              role="columnheader"
              style={{ padding: "14px 4px" }}
              className={`text-center font-content text-sm leading-tight font-semibold break-words text-white ${
                i % 2 === 0 ? GRID_HEADER_CELL_A : GRID_HEADER_CELL_B
              }`}
            >
              {c.label}
            </div>
          ))}
        </div>

        {config.rows.map((row, index) => {
          const stmtId = `${uid}stmt-${row.id}`;
          return (
            <div role="row" key={row.id} className="contents">
              <div
                role="rowheader"
                id={stmtId}
                style={{ padding: "20px 14px 18px 18px" }}
                className="flex items-start gap-2.5 border-t border-[#f0e8cf] bg-white dark:border-white/[0.08] dark:bg-neutral-800"
              >
                <span className="item-number-badge" aria-label={`Рядок ${index + 1}`}>
                  {index + 1}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <span className="min-w-0 break-words font-content text-base leading-[1.5] text-[#1a1640] dark:text-neutral-100">
                    {frenchNbsp(row.label)}
                  </span>
                  {rowPointsTab(row, false)}
                </div>
              </div>
              {columns.map((c, i) => {
                const colId = `${uid}col-${c.id}`;
                const descId = `${uid}desc-${row.id}-${c.id}`;
                return (
                  <div
                    key={c.id}
                    role="gridcell"
                    className={`flex items-center justify-center border-t border-[#f0e8cf] dark:border-white/[0.08] ${
                      i % 2 === 0 ? GRID_COL_ODD : GRID_COL_EVEN
                    }`}
                  >
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

  // Мобільні картки (<768px, п.6 задачі) — одна gold-рамкована картка на
  // твердження (той самий вигляд, що .glass-item-card інших типів вправ),
  // бали — RowPointsTab-патерн на верхній рамці (.row-points-tab-wrap).
  function renderMobileCards() {
    return (
      <div className="flex flex-col gap-4 md:hidden">
        {config.rows.map((row, index) => (
          <div key={row.id} className="row-points-tab-wrap">
            {rowPointsTab(row, true)}
            <div className="glass-item-card flex flex-col gap-3 p-3.5">
              <div className="flex items-start gap-2.5">
                <span className="item-number-badge" aria-label={`Твердження ${index + 1}`}>
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 break-words font-content text-base leading-[1.5] text-[#1a1640] dark:text-neutral-100">
                  {frenchNbsp(row.label)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {config.columns.map((col) => renderOptionTile(row, col))}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Плитки toggle-картки "Правильні відповіді" — одна картка на
  // твердження (той самий .task-result-gap-row, що гап-типи), всередині —
  // усі правильні назви колонок як дрібні чипи (.task-result-gap-word).
  function correctAnswerRows() {
    if (!singleDetail) return [];
    return config.rows.map((row, index) => {
      const correctLabels = singleDetail.cells
        .filter((c) => c.rowId === row.id && c.correctChecked)
        .map((c) => config.columns.find((col) => col.id === c.columnId)?.label ?? c.columnId);
      return { number: index + 1, label: row.label, correctLabels };
    });
  }

  return (
    <div className={EXERCISE_STACK}>
      <BlockTabs plaqueText={plaqueText} />
      <TaskPanelHeader
        instructionText={config.instructions ?? DEFAULT_INSTRUCTIONS.checkbox_grid.instruction}
        subInstructionText={config.subInstructions ?? DEFAULT_INSTRUCTIONS.checkbox_grid.subInstruction}
      />

      {renderDesktopTable()}
      {renderMobileCards()}

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
        </div>
      )}

      {isPractice ? (
        <div className="flex flex-col gap-2">
          {!practiceCorrect && (
            <button
              type="button"
              onClick={submitPractice}
              disabled={practiceCheck.pending}
              className={`self-start ${STUDENT_BUTTON_PRIMARY}`}
            >
              {practiceCheck.pending ? "Перевіряю..." : "Перевірити"}
            </button>
          )}
          {practiceCorrect && (
            <p className={`${RESULT_MESSAGE_CLASS} text-green-600 dark:text-green-400`}>Правильно! ✓</p>
          )}
          {practiceDetail && !practiceCorrect && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-red-600 dark:text-red-400">
                Неправильно, спробуйте ще раз (спроб: {practiceFailedAttempts[WHOLE_TASK_ITEM_ID] ?? 0})
              </span>
              {!practiceCheck.revealed[WHOLE_TASK_ITEM_ID] && (
                <button
                  type="button"
                  onClick={() => practiceCheck.reveal(WHOLE_TASK_ITEM_ID, true)}
                  disabled={!!practiceCheck.revealPending[WHOLE_TASK_ITEM_ID]}
                  className={STUDENT_BUTTON_SECONDARY_TOUCH}
                >
                  Показати відповідь
                </button>
              )}
            </div>
          )}
          {practiceCheck.revealed[WHOLE_TASK_ITEM_ID] && (
            <ul className="flex flex-col gap-0.5 text-sm italic text-amber-700 dark:text-amber-400">
              {practiceCheck.revealed[WHOLE_TASK_ITEM_ID].map((pair) => {
                const [rowId, columnIdsStr] = pair.split(":");
                const row = config.rows.find((r) => r.id === rowId);
                const columnIds = columnIdsStr ? columnIdsStr.split(",") : [];
                const labels = columnIds
                  .map((id) => config.columns.find((c) => c.id === id)?.label ?? id)
                  .join(", ");
                return (
                  <li key={rowId}>
                    {row?.label ?? rowId}: {labels || "—"}
                  </li>
                );
              })}
            </ul>
          )}
          {practiceCheck.error && <p className="text-sm text-red-600 dark:text-red-400">{practiceCheck.error}</p>}
        </div>
      ) : (
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
          <TaskResult
            correct={result.correct}
            pointsEarned={result.pointsEarned}
            pointsPossible={result.pointsPossible}
            toggleTitle={TABLE_FILL_ANSWERS_TOGGLE_LABEL}
            toggleCount={singleDetail ? config.rows.length : undefined}
          >
            {singleDetail && (
              <div className="flex flex-col gap-2">
                {correctAnswerRows().map((r) => (
                  <div key={r.number} className="task-result-gap-row">
                    <span className="task-result-answer-num" aria-hidden="true">
                      {r.number}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <span className="task-result-gap-text">{frenchNbsp(r.label)}</span>
                      <div className="flex flex-wrap gap-1.5">
                        {r.correctLabels.length === 0 ? (
                          <span className="task-result-gap-word">—</span>
                        ) : (
                          r.correctLabels.map((l, idx) => (
                            <span key={idx} className="task-result-gap-word">
                              {l}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TaskResult>
        )}
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>
      )}
    </div>
  );
}
