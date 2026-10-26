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

// Легенда під таблицею — дрібний квадрат-зразок, та сама форма, що й
// справжній чекбокс, кольори написані тут же (НЕ .cg-checkbox-клас: тут
// звичайний flex-рядок, а не grid-клітинка, конфлікту display немає, тож
// літеральні Tailwind-класи безпечні — проблема була лише там, де display
// (grid/none/block) рахувався кількома класами одного елемента).
const LEGEND_SQUARE = "flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border-2";
const LEGEND_CORRECT_CLASS = "border-[#4cc47e] bg-[#eafaf0] dark:border-[#4cc47e] dark:bg-[rgba(47,158,91,0.28)]";
const LEGEND_WRONG_CLASS =
  "border-[#e5484d] bg-[#fdeeee] dark:border-[rgba(255,140,140,0.45)] dark:bg-[rgba(255,120,120,0.16)]";
const LEGEND_ICON_CORRECT = "h-2.5 w-2.5 text-[#1f7a3d] dark:text-[#bff0d0]";
const LEGEND_ICON_WRONG = "h-2.5 w-2.5 text-[#b42318] dark:text-[#ffb4ae]";

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

  // Пілюля балів рядка — ДВА різних класи під два різних контексти, обидва
  // вже визначені в globals.css (не Tailwind arbitrary, задача п.1/2): у
  // десктоп-таблиці пілюля йде ВСЕРЕДИНІ клітинки-твердження, ширина за
  // вмістом (.cg-points-pill); на мобільній картці — той самий RowPointsTab-
  // патерн, що інші типи вправ (.row-points-tab-wrap + .row-points-tab,
  // абсолютно на верхній рамці картки, table-fill.tsx).
  function rowPointsTab(row: CheckboxGridPublic["rows"][number], variant: "pill" | "tab") {
    if (hidePoints) return null;
    const rowCell = detail?.cells.find((c) => c.rowId === row.id);
    if (!pointsVisible && !rowCell) return null;
    const base = variant === "pill" ? "cg-points-pill" : "row-points-tab";
    if (!rowCell) {
      return (
        <span className={base}>
          {formatPointsValue(row.points)} {pluralizePoints(row.points)}
        </span>
      );
    }
    const status = rowPointsTabStatus(rowCell.earnedPoints, row.points);
    return (
      <span className={`${base} ${base}--${status}`}>
        {status === "correct" && <Check strokeWidth={3} className="h-3 w-3" />}
        {status === "wrong" && <X strokeWidth={3} className="h-3 w-3" />}
        {formatPointsValue(rowCell.earnedPoints)} з {formatPointsValue(row.points)}
      </span>
    );
  }

  // Квадрат-чекбокс десктоп-таблиці (.cg-checkbox, globals.css) — нативний
  // <input type="checkbox"> лишається sr-only, видимий квадрат — сусідній
  // <span> (стан рахується в JS, answers-set, а не CSS :checked). descId —
  // прихований текст стану для читалки (aria-describedby), окремий від
  // aria-labelledby (назва колонки + твердження).
  function renderCheckboxControl(rowId: string, columnId: string, labelledBy: string, descId: string) {
    const checked = answers[rowId]?.has(columnId) ?? false;
    const cell = detail?.cells.find((c) => c.rowId === rowId && c.columnId === columnId);

    let stateClass = checked ? "cg-checkbox--checked" : "";
    let icon: React.ReactNode = checked ? <Check strokeWidth={3.6} className="h-4 w-4 text-white" /> : null;
    let stateText = "";

    if (cell) {
      if (cell.studentChecked && cell.correctChecked) {
        stateClass = "cg-checkbox--correct";
        icon = <Check strokeWidth={3.6} className="h-4 w-4 text-[#1f7a3d] dark:text-[#bff0d0]" />;
        stateText = "правильно";
      } else if (cell.studentChecked && !cell.correctChecked) {
        stateClass = "cg-checkbox--wrong";
        icon = <X strokeWidth={3.6} className="h-4 w-4 text-[#b42318] dark:text-[#ffb4ae]" />;
        stateText = "помилково";
      } else {
        stateClass = "";
        icon = null;
      }
    }

    return (
      <label className="flex min-h-11 w-full min-w-11 items-center justify-center">
        <input
          type="checkbox"
          className="cg-checkbox-input sr-only"
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
        <span aria-hidden="true" className={`cg-checkbox ${stateClass}`}>
          {icon}
        </span>
      </label>
    );
  }

  // Плитка-опція мобільної картки (.cg-tile, globals.css) — компактний
  // рядок (checkbox-коло 24px + назва), не розтягнутий на всю ширину банер.
  function renderOptionTile(row: CheckboxGridPublic["rows"][number], col: CheckboxGridPublic["columns"][number]) {
    const checked = answers[row.id]?.has(col.id) ?? false;
    const cell = detail?.cells.find((c) => c.rowId === row.id && c.columnId === col.id);

    let tileClass = checked ? "cg-tile--checked" : "";
    let icon: React.ReactNode = checked ? <Check strokeWidth={3.6} className="h-3 w-3 text-white" /> : null;
    let stateText = "";

    if (cell) {
      if (cell.studentChecked && cell.correctChecked) {
        tileClass = "cg-tile--correct";
        icon = <Check strokeWidth={3.6} className="h-3 w-3 text-[#1f7a3d] dark:text-[#bff0d0]" />;
        stateText = "правильно";
      } else if (cell.studentChecked && !cell.correctChecked) {
        tileClass = "cg-tile--wrong";
        icon = <X strokeWidth={3.6} className="h-3 w-3 text-[#b42318] dark:text-[#ffb4ae]" />;
        stateText = "помилково";
      } else {
        tileClass = "";
        icon = null;
      }
    }

    const descId = `${uid}desc-tile-${row.id}-${col.id}`;

    return (
      <label key={col.id} className={`cg-tile ${tileClass}`}>
        <input
          type="checkbox"
          className="cg-tile-input sr-only"
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
        <span aria-hidden="true" className="cg-tile-check">
          {icon}
        </span>
        <span className="cg-tile-label">{col.label}</span>
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

  // Десктоп-таблиця (md+, п.1 задачі) — справжня CSS-grid таблиця
  // (.cg-grid-row: minmax(0,1fr) + N×minmax(84px,110px), --cg-cols —
  // інлайн-стиль на КОЖНОМУ рядку, довільна кількість опцій без зміни CSS).
  // Жодного display, що конкурує сам із собою — .cg-desktop/.cg-card/
  // .cg-grid-row — власні класи з ОДНИМ значенням display кожен.
  function renderDesktopTable() {
    const columns = config.columns;
    const cgCols = { "--cg-cols": columns.length } as React.CSSProperties;
    return (
      <div className="cg-desktop">
        <div className="cg-card" role="table">
          <div className="cg-grid-row" style={cgCols} role="row">
            {/* Клітинка над колонкою твердження — порожня (п.1 задачі:
                "empty first cell"). */}
            <div aria-hidden="true" className="cg-header-empty" />
            {columns.map((c, i) => (
              <div
                key={c.id}
                id={`${uid}col-${c.id}`}
                role="columnheader"
                className={`cg-header-cell ${i % 2 === 0 ? "cg-header-cell--a" : "cg-header-cell--b"}`}
              >
                {c.label}
              </div>
            ))}
          </div>

          {config.rows.map((row, index) => {
            const stmtId = `${uid}stmt-${row.id}`;
            return (
              <div key={row.id} className="cg-grid-row" style={cgCols} role="row">
                <div role="rowheader" id={stmtId} className="cg-stmt-cell">
                  <span className="item-number-badge" aria-label={`Рядок ${index + 1}`}>
                    {index + 1}
                  </span>
                  <div className="cg-stmt-text-col">
                    <span className="cg-stmt-text">{frenchNbsp(row.label)}</span>
                    {rowPointsTab(row, "pill")}
                  </div>
                </div>
                {columns.map((c, i) => {
                  const colId = `${uid}col-${c.id}`;
                  const descId = `${uid}desc-${row.id}-${c.id}`;
                  return (
                    <div
                      key={c.id}
                      role="gridcell"
                      className={`cg-option-cell ${i % 2 === 0 ? "cg-option-cell--odd" : "cg-option-cell--even"}`}
                    >
                      {renderCheckboxControl(row.id, c.id, `${colId} ${stmtId}`, descId)}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Мобільні картки (<768px, п.2 задачі) — одна gold-рамкована картка на
  // твердження (.cg-mobile-card), бали — RowPointsTab-патерн на верхній
  // рамці (.row-points-tab-wrap, той самий, що table-fill.tsx), під
  // твердженням — 2-колонкова сітка компактних плиток-опцій (.cg-tile).
  function renderMobileCards() {
    return (
      <div className="cg-mobile">
        {config.rows.map((row, index) => (
          <div key={row.id} className="row-points-tab-wrap">
            {rowPointsTab(row, "tab")}
            <div className="cg-mobile-card">
              <div className="cg-mobile-stmt">
                <span className="item-number-badge" aria-label={`Твердження ${index + 1}`}>
                  {index + 1}
                </span>
                <span className="cg-mobile-stmt-text">{frenchNbsp(row.label)}</span>
              </div>
              <div className="cg-option-grid">{config.columns.map((col) => renderOptionTile(row, col))}</div>
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
            <span aria-hidden="true" className={`${LEGEND_SQUARE} ${LEGEND_CORRECT_CLASS}`}>
              <Check strokeWidth={3} className={LEGEND_ICON_CORRECT} />
            </span>
            правильно
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true" className={`${LEGEND_SQUARE} ${LEGEND_WRONG_CLASS}`}>
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
