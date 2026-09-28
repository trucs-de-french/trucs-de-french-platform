"use client";

import { useState, useEffect, type ReactNode } from "react";
import type { TableFillPublic, TableFillDetail, TableFillAnswer, GradeResult } from "@/lib/exercises/types";
import { useExerciseCheck } from "./use-exercise-check";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";
import { pluralizePoints } from "@/lib/pluralize-points";
import { InstructionsText } from "./instructions-text";
import { STUDENT_BUTTON_PRIMARY } from "@/lib/button-styles";
import { DiacriticsPopup, useDiacriticsPopup, insertAtCursor, focusAndSetCursor } from "./diacritics-popup";
import { HintExplanation } from "./hint-explanation";
import { EXERCISE_STACK } from "@/lib/spacing";
import { RESULT_MESSAGE_CLASS, SCORE_LABEL_CLASS } from "./score-style";

function cellKey(rowId: string, side: "left" | "right") {
  return `${rowId}:${side}`;
}

// sanitizeTableFill (sanitize.ts) уже підставляє цей самий дефолт, якщо
// його нема в конфізі — тут другий шар захисту саме на випадок конфіга, що
// оминув sanitize (напр. застарілий кеш/бандл), щоб рендер рядка заголовка
// таблиці не падав на columnLabels[0] з undefined.
const DEFAULT_COLUMN_LABELS: [string, string] = ["Французька", "Переклад"];

// Рядків довше 10 — розбиваємо навпіл на дві колонки, кожна зі своїм
// рядком підписів колонок (лише щоб довга таблиця не розтягувалась на всю
// висоту сторінки в один стовпець).
const SPLIT_THRESHOLD = 10;

type Row = TableFillPublic["rows"][number];

// Одна колонка вправи — або половина рядків, або вся вправа одним
// стовпцем; завжди зі своїм рядком підписів колонок.
function TableFillColumn({
  rows,
  columnLabels,
  renderCell,
  rowPointsLabel,
}: {
  rows: Row[];
  columnLabels: [string, string];
  renderCell: (rowId: string, side: "left" | "right", value: string | null) => ReactNode;
  rowPointsLabel: (row: Row) => string | null;
}) {
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-base">
          <thead>
            <tr className="border-b border-gray-200 text-left text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
              <th className="py-1 pr-2 font-medium">{columnLabels[0]}</th>
              <th className="py-1 pr-2 font-medium">{columnLabels[1]}</th>
              <th className="py-1 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-gray-200 last:border-0 dark:border-neutral-700">
                <td className="py-1 pr-2">{renderCell(row.id, "left", row.left)}</td>
                <td className="py-1 pr-2">{renderCell(row.id, "right", row.right)}</td>
                <td className={`py-1 ${SCORE_LABEL_CLASS}`}>
                  {rowPointsLabel(row)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function TableFillExercise({
  taskId,
  config,
  pointsVisible,
  onResult,
  hidePoints,
  isDelf,
}: {
  taskId: string;
  config: TableFillPublic;
  pointsVisible: boolean;
  onResult?: (result: GradeResult) => void;
  hidePoints?: boolean;
  // Задача належить DELF-тесту — підказки повністю вимкнені (той самий
  // принцип, що fill-blank.tsx).
  isDelf?: boolean;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  // Клітинки (rowId:side), де брали підказку "перша літера" — той самий
  // ключ-формат, що cellKey нижче.
  const [hintedCells, setHintedCells] = useState<Set<string>>(new Set());
  const [hintPending, setHintPending] = useState(false);
  const diacritics = useDiacriticsPopup<string>();
  const { submit, pending, result, error } = useExerciseCheck(taskId);
  const detail = result?.detail as TableFillDetail | undefined;
  const columnLabels = config.columnLabels ?? DEFAULT_COLUMN_LABELS;

  useEffect(() => {
    if (result) onResult?.(result);
  }, [result, onResult]);

  function updateAnswer(rowId: string, side: "left" | "right", value: string) {
    setAnswers((prev) => ({ ...prev, [cellKey(rowId, side)]: value }));
    setHintedCells((prev) => {
      const key = cellKey(rowId, side);
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }

  // Перша літера правильної відповіді, з сервера (/api/exercises/hint) —
  // конфіг ніколи не містить correctAnswers на клієнті. Той самий принцип
  // вписування, що fill-blank.tsx: замінює вміст, лише якщо поле порожнє чи
  // починається не з цієї літери.
  async function applyHint(rowId: string, side: "left" | "right") {
    const key = cellKey(rowId, side);
    if (hintedCells.has(key) || hintPending) return;
    setHintPending(true);
    try {
      const res = await fetch("/api/exercises/hint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, kind: "table_fill", rowId, side }),
      });
      if (!res.ok) return;
      const { letter } = (await res.json()) as { letter: string };
      const current = answers[key] ?? "";
      const value = current.startsWith(letter) ? current : letter;
      setAnswers((prev) => ({ ...prev, [key]: value }));
      setHintedCells((prev) => new Set(prev).add(key));
      focusAndSetCursor(diacritics.getElement(key), letter.length);
    } finally {
      setHintPending(false);
    }
  }

  function inputClass(rowId: string, side: "left" | "right") {
    const idle = "border-gray-300 dark:border-neutral-600";
    if (!detail) return hintedCells.has(cellKey(rowId, side))
      ? "border-sky-400 bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400"
      : idle;
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
    const hintUsed = detail?.blanks.find((b) => b.rowId === rowId && b.side === side)?.hintUsed;
    return (
      <div className="flex items-center gap-1">
        <input
          ref={diacritics.fieldRef(key)}
          value={answers[key] ?? ""}
          onChange={(e) => updateAnswer(rowId, side, e.target.value)}
          onFocus={() => diacritics.onFocus(key)}
          onBlur={diacritics.onBlur}
          disabled={!!result}
          className={`w-full rounded border px-2 py-1 text-base ${inputClass(rowId, side)}`}
        />
        {hintUsed && (
          <span className="shrink-0 text-xs italic text-amber-600 dark:text-amber-400">з підказкою</span>
        )}
      </div>
    );
  }

  function handleSubmit() {
    const cells = Object.entries(answers).map(([key, value]) => {
      const [rowId, side] = key.split(":") as [string, "left" | "right"];
      return { rowId, side, value };
    });
    const hintedCellsList = [...hintedCells].map((key) => {
      const [rowId, side] = key.split(":") as [string, "left" | "right"];
      return { rowId, side };
    });
    const answer: TableFillAnswer = { cells, hintedCells: hintedCellsList };
    submit(answer);
  }

  // Поділ — ЛИШЕ візуальний: кожна колонка нижче несе підмножину ТИХ САМИХ
  // об'єктів row (той самий row.id), відповіді (cellKey/rowId) і список
  // помилок нижче (config.rows.findIndex за ПОВНИМ, неподіленим масивом)
  // узагалі не звертаються до цього поділу — індекси/бали не можуть розійтись.
  let columns: { key: string; rows: Row[] }[];
  if (config.rows.length > SPLIT_THRESHOLD) {
    const mid = Math.ceil(config.rows.length / 2);
    columns = [
      { key: "col-a", rows: config.rows.slice(0, mid) },
      { key: "col-b", rows: config.rows.slice(mid) },
    ];
  } else {
    columns = [{ key: "all", rows: config.rows }];
  }

  return (
    <div className={EXERCISE_STACK}>
      <InstructionsText
        text={config.instructions ?? DEFAULT_INSTRUCTIONS.table_fill.instruction}
        subText={config.subInstructions ?? DEFAULT_INSTRUCTIONS.table_fill.subInstruction}
      />

      <HintExplanation
        type="table_fill"
        hintsReducePoints={config.hintsReducePoints}
        hidden={!!isDelf || !!result}
      />

      <div
        className={`mx-auto w-full ${
          columns.length > 1
            ? "grid max-w-5xl grid-cols-1 items-start gap-x-8 gap-y-6 md:grid-cols-2"
            : "max-w-3xl"
        }`}
      >
        {columns.map((col) => (
          <TableFillColumn
            key={col.key}
            rows={col.rows}
            columnLabels={columnLabels}
            renderCell={renderCell}
            rowPointsLabel={rowPointsLabel}
          />
        ))}
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
          onHint={
            isDelf
              ? undefined
              : () => {
                  const key = diacritics.activeKey!;
                  const rowId = key.slice(0, key.lastIndexOf(":"));
                  const side = key.slice(key.lastIndexOf(":") + 1) as "left" | "right";
                  applyHint(rowId, side);
                }
          }
          hintDisabled={hintPending || (diacritics.activeKey ? hintedCells.has(diacritics.activeKey) : false)}
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
                Рядок {config.rows.findIndex((r) => r.id === b.rowId) + 1}, {columnLabels[b.side === "left" ? 0 : 1]}: правильно — {b.correctAnswers.join(" / ")}
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
