"use client";

import { useState, useEffect, type ReactNode } from "react";
import type { TableFillPublic, TableFillDetail, GradeResult } from "@/lib/exercises/types";
import { useExerciseCheck } from "./use-exercise-check";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";
import { pluralizePoints } from "@/lib/pluralize-points";
import { InstructionsText } from "./instructions-text";
import { STUDENT_BUTTON_PRIMARY } from "@/lib/button-styles";
import { DiacriticsPopup, useDiacriticsPopup, insertAtCursor, focusAndSetCursor } from "./diacritics-popup";
import { EXERCISE_STACK } from "@/lib/spacing";
import {
  PART_OF_SPEECH_ORDER,
  PART_OF_SPEECH_LABELS_FR,
  PART_OF_SPEECH_COLORS,
  type PartOfSpeech,
} from "@/lib/vocab-categories";

function cellKey(rowId: string, side: "left" | "right") {
  return `${rowId}:${side}`;
}

// sanitizeTableFill (sanitize.ts) уже підставляє цей самий дефолт, якщо
// його нема в конфізі — тут другий шар захисту саме на випадок конфіга, що
// оминув sanitize (напр. застарілий кеш/бандл), щоб рендер рядка заголовка
// таблиці не падав на columnLabels[0] з undefined.
const DEFAULT_COLUMN_LABELS: [string, string] = ["Французька", "Переклад"];

// Рядки без categорій довше 10 — розбиваємо навпіл на дві колонки без
// заголовків груп (лише щоб довга таблиця не розтягувалась на всю висоту
// сторінки в один стовпець).
const SPLIT_WITHOUT_CATEGORY_THRESHOLD = 10;

type Row = TableFillPublic["rows"][number];

// Той самий принцип, що groupVocabByPartOfSpeech (vocab.ts): PART_OF_SPEECH_ORDER
// напряму, легасі-група без категорії — останньою. row.partOfSpeech тут уже
// нормалізований (sanitizeTableFill викликає normalizePartOfSpeech), тож
// звірка з PART_OF_SPEECH_ORDER напряму, без повторної нормалізації.
function groupRowsByPartOfSpeech(rows: Row[]): { partOfSpeech: PartOfSpeech | null; rows: Row[] }[] {
  const buckets = new Map<PartOfSpeech | null, Row[]>();
  for (const r of rows) {
    const key = r.partOfSpeech ?? null;
    const arr = buckets.get(key) ?? [];
    arr.push(r);
    buckets.set(key, arr);
  }
  const groups: { partOfSpeech: PartOfSpeech | null; rows: Row[] }[] = [];
  for (const pos of PART_OF_SPEECH_ORDER) {
    const items = buckets.get(pos);
    if (items?.length) groups.push({ partOfSpeech: pos, rows: items });
  }
  const other = buckets.get(null);
  if (other?.length) groups.push({ partOfSpeech: null, rows: other });
  return groups;
}

// Одна колонка вправи — або категорія (label+dotClass задані), або половина
// без категорій, або вся вправа одним стовпцем (label null в обох випадках,
// відрізняються лише набором rows). Сама таблиця — той самий рендер, що був
// раніше, лише тепер параметризований підмножиною рядків.
function TableFillColumn({
  label,
  dotClass,
  rows,
  columnLabels,
  renderCell,
  rowPointsLabel,
}: {
  label: string | null;
  dotClass: string | null;
  rows: Row[];
  columnLabels: [string, string];
  renderCell: (rowId: string, side: "left" | "right", value: string | null) => ReactNode;
  rowPointsLabel: (row: Row) => string | null;
}) {
  return (
    <div>
      {label && (
        <div className="mb-1 flex items-center gap-2">
          {dotClass && <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotClass}`} aria-hidden />}
          <h3 className="font-heading text-sm font-bold text-neutral-700 dark:text-neutral-300">{label}</h3>
        </div>
      )}
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
                <td className="py-1 text-xs italic text-neutral-500 dark:text-neutral-400">
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
  const columnLabels = config.columnLabels ?? DEFAULT_COLUMN_LABELS;

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

  // Групування — ЛИШЕ візуальне: кожна колонка нижче несе підмножину ТИХ
  // САМИХ об'єктів row (той самий row.id), відповіді (cellKey/rowId) і
  // список помилок нижче (config.rows.findIndex за ПОВНИМ, негрупованим
  // масивом) узагалі не звертаються до цього поділу — індекси/бали не
  // можуть розійтись.
  const hasAnyCategory = config.rows.some((r) => r.partOfSpeech);
  let columns: { key: string; label: string | null; dotClass: string | null; rows: Row[] }[];
  if (hasAnyCategory) {
    const groups = groupRowsByPartOfSpeech(config.rows);
    // Захист від краю: якщо після групування лишилась рівно одна група і це
    // "Інше" — заголовок зайвий (виглядав би як "Інше" над усією вправою).
    const suppressLabels = groups.length === 1 && groups[0].partOfSpeech === null;
    columns = groups.map((g) => ({
      key: g.partOfSpeech ?? "other",
      label: suppressLabels ? null : g.partOfSpeech ? PART_OF_SPEECH_LABELS_FR[g.partOfSpeech] : "Інше",
      dotClass: g.partOfSpeech ? PART_OF_SPEECH_COLORS[g.partOfSpeech].dot : null,
      rows: g.rows,
    }));
  } else if (config.rows.length > SPLIT_WITHOUT_CATEGORY_THRESHOLD) {
    const mid = Math.ceil(config.rows.length / 2);
    columns = [
      { key: "col-a", label: null, dotClass: null, rows: config.rows.slice(0, mid) },
      { key: "col-b", label: null, dotClass: null, rows: config.rows.slice(mid) },
    ];
  } else {
    columns = [{ key: "all", label: null, dotClass: null, rows: config.rows }];
  }

  return (
    <div className={EXERCISE_STACK}>
      <InstructionsText
        text={config.instructions ?? DEFAULT_INSTRUCTIONS.table_fill}
        subText={config.subInstructions}
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
            label={col.label}
            dotClass={col.dotClass}
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
