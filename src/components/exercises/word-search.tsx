"use client";

import { useState, useEffect, useRef } from "react";
import type { WordSearchPublic, WordSearchDetail, WordSearchAnswer, GradeResult } from "@/lib/exercises/types";
import { useExerciseCheck } from "./use-exercise-check";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";
import { pluralizePoints } from "@/lib/pluralize-points";
import { sanitizeInstructionsHtml } from "@/lib/sanitize-instructions-html";
import { ImageOrPlaceholder } from "@/components/image-or-placeholder";
import { STUDENT_BUTTON_PRIMARY } from "@/lib/button-styles";

type Cell = { row: number; col: number };

// Лише пряма лінія (горизонталь/вертикаль, без діагоналей) — той самий
// принцип, що й розміщення слів у сітці (word-search-grid.ts). Якщо
// end не вирівняний по row/col зі start, лінія не будується взагалі (рух
// просто ігнорується, доки студент не повернеться на валідну вісь).
function buildPath(start: Cell, end: Cell): Cell[] {
  if (start.row === end.row) {
    const step = end.col >= start.col ? 1 : -1;
    const cells: Cell[] = [];
    for (let c = start.col; c !== end.col + step; c += step) cells.push({ row: start.row, col: c });
    return cells;
  }
  if (start.col === end.col) {
    const step = end.row >= start.row ? 1 : -1;
    const cells: Cell[] = [];
    for (let r = start.row; r !== end.row + step; r += step) cells.push({ row: r, col: start.col });
    return cells;
  }
  return [start];
}

function cellKey(c: Cell): string {
  return `${c.row}:${c.col}`;
}

export function WordSearchExercise({
  taskId,
  config,
  pointsVisible,
  onResult,
  hidePoints,
}: {
  taskId: string;
  config: WordSearchPublic;
  pointsVisible: boolean;
  onResult?: (result: GradeResult) => void;
  hidePoints?: boolean;
}) {
  // Клієнтський збіг за ЛІТЕРАМИ (не координатами — публічна конфігурація
  // взагалі не містить placements) — лише для миттєвого відгуку "знайдено!"
  // під час гри. Авторитетна перевірка все одно на сервері (gradeWordSearch,
  // за координатами) — той самий принцип, що всюди: клієнт ніколи не є
  // єдиним джерелом правди про правильність.
  const [foundWords, setFoundWords] = useState<Map<string, Cell[]>>(new Map());
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState<Cell | null>(null);
  const [dragEnd, setDragEnd] = useState<Cell | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const { submit, pending, result, error } = useExerciseCheck(taskId);
  const detail = result?.detail as WordSearchDetail | undefined;
  const locked = !!result;

  useEffect(() => {
    if (result) onResult?.(result);
  }, [result, onResult]);

  function startDrag(cell: Cell) {
    if (locked) return;
    setDragging(true);
    setDragStart(cell);
    setDragEnd(cell);
  }

  function moveDrag(cell: Cell) {
    if (!dragging || !dragStart) return;
    if (cell.row === dragStart.row || cell.col === dragStart.col) {
      setDragEnd(cell);
    }
  }

  function endDrag() {
    if (dragStart && dragEnd) {
      const path = buildPath(dragStart, dragEnd);
      if (path.length > 1) {
        const letters = path.map((c) => config.grid[c.row][c.col]).join("");
        const reversed = [...letters].reverse().join("");
        const match = config.words.find(
          (w) => !foundWords.has(w.word) && (w.word.toUpperCase() === letters || w.word.toUpperCase() === reversed)
        );
        if (match) {
          setFoundWords((prev) => new Map(prev).set(match.word, path));
        }
      }
    }
    setDragging(false);
    setDragStart(null);
    setDragEnd(null);
  }

  // mouseup поза сіткою (студент відпустив за її межами) усе одно мусить
  // завершити drag — слухач на document, не на самій сітці.
  useEffect(() => {
    if (!dragging) return;
    function onUp() {
      endDrag();
    }
    document.addEventListener("mouseup", onUp);
    document.addEventListener("touchend", onUp);
    return () => {
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("touchend", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging, dragStart, dragEnd]);

  function cellFromTouch(touch: React.Touch): Cell | null {
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const target = (el as HTMLElement | null)?.closest("[data-row]") as HTMLElement | null;
    if (!target) return null;
    return { row: Number(target.dataset.row), col: Number(target.dataset.col) };
  }

  const previewPath = dragging && dragStart && dragEnd ? buildPath(dragStart, dragEnd) : [];
  const previewKeys = new Set(previewPath.map(cellKey));
  const foundKeys = new Set([...foundWords.values()].flatMap((cells) => cells.map(cellKey)));

  function cellClass(cell: Cell) {
    const key = cellKey(cell);
    if (previewKeys.has(key)) return "bg-blue-200 dark:bg-blue-800";
    if (foundKeys.has(key)) return "bg-green-200 dark:bg-green-800";
    return "";
  }

  function isFound(word: string): boolean {
    if (detail) return detail.words.find((d) => d.word === word)?.found ?? false;
    return foundWords.has(word);
  }

  // Одна підказка на слово, не кілька одночасно — картинка пріоритетніша за
  // переклад, переклад пріоритетніший за саме слово (яке студент і так
  // шукає, тож показувати його як "підказку" мало б сенс лише за
  // відсутності кращих варіантів).
  function hintKind(w: WordSearchPublic["words"][number]): "image" | "translation" | "word" {
    if (w.imageUrl) return "image";
    if (w.translation) return "translation";
    return "word";
  }

  function handleSubmit() {
    const answer: WordSearchAnswer = [...foundWords.entries()].map(([word, cells]) => ({
      word,
      cells,
    }));
    submit(answer);
  }

  return (
    <div>
      <div className="mb-2">
        <div className="flex flex-wrap items-baseline gap-2 font-medium">
          <div
            dangerouslySetInnerHTML={{
              __html: sanitizeInstructionsHtml(config.instructions ?? DEFAULT_INSTRUCTIONS.word_search),
            }}
          />
          {!hidePoints && (pointsVisible || detail) && (
            <span className="text-xs font-normal italic text-neutral-500 dark:text-neutral-400">
              {detail
                ? `${result?.correct ? config.points : 0}/${config.points} ${pluralizePoints(config.points)}`
                : `${config.points} ${pluralizePoints(config.points)}`}
            </span>
          )}
        </div>
        {config.subInstructions && (
          <div
            className="mt-0.5 text-sm font-normal text-neutral-500 dark:text-neutral-400"
            dangerouslySetInnerHTML={{ __html: sanitizeInstructionsHtml(config.subInstructions) }}
          />
        )}
      </div>

      {/* gap-3 (не gap-4) — той самий 12px, що padding блока завдання
          (EXERCISE_BLOCK_CLASS + p-3): зазор між сіткою й панеллю карток має
          дорівнювати відступу від зовнішньої межі блоку, інакше з одного
          боку панель "притиснута" тісніше, ніж з інших. */}
      <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-start">
        <div
          ref={gridRef}
          className="inline-block touch-none select-none shadow-md"
          onTouchMove={(e) => {
            const cell = cellFromTouch(e.touches[0]);
            if (cell) moveDrag(cell);
          }}
        >
          <table className="border-collapse font-mono text-base">
            <tbody>
              {config.grid.map((row, ri) => (
                <tr key={ri}>
                  {row.map((letter, ci) => (
                    <td
                      key={ci}
                      data-row={ri}
                      data-col={ci}
                      onMouseDown={() => startDrag({ row: ri, col: ci })}
                      onMouseEnter={() => moveDrag({ row: ri, col: ci })}
                      onTouchStart={() => startDrag({ row: ri, col: ci })}
                      className={`h-7 w-7 cursor-pointer border border-neutral-200 text-center leading-7 dark:border-neutral-700 ${cellClass({ row: ri, col: ci })}`}
                    >
                      {letter}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Одна СПІЛЬНА сітка карток для ОБОХ видів підказки (картинка й
            текст) — не два окремі grid-и, щоб легенда виглядала цілісно,
            навіть коли в одному завданні є суміш обох. Однакові рамка/
            заокруглення/тінь/відступ (CARD_BASE) на кожній картці, лише
            вміст усередині різниться. minmax(5.5rem,1fr) — ширше, ніж чиста
            картинка-плитка потребувала б, бо переклад буває довшим за одне
            слово ("дозвіл, шкільний бланк") і має кудись загорнутись. */}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2 md:w-72 md:shrink-0">
          {config.words.map((w) => {
            const found = isFound(w.word);
            const kind = hintKind(w);
            return (
              <div
                key={w.word}
                className={`flex flex-col items-center justify-center gap-1 rounded-lg border p-3 text-center shadow-sm transition-colors ${
                  found
                    ? "border-green-500 bg-green-50 dark:bg-green-950/30"
                    : "border-gray-100 bg-white dark:border-neutral-700 dark:bg-neutral-800"
                }`}
              >
                {kind === "image" ? (
                  <>
                    <ImageOrPlaceholder
                      src={w.imageUrl}
                      alt=""
                      className="h-14 w-14 rounded object-cover"
                    />
                    {found && (
                      <span className="text-xs font-medium text-green-600 dark:text-green-400">
                        {w.word}
                      </span>
                    )}
                  </>
                ) : (
                  <span className={`text-sm ${found ? "text-green-600 line-through dark:text-green-400" : ""}`}>
                    {kind === "translation" ? w.translation : w.word}
                  </span>
                )}
                {w.audioUrl && <audio controls src={w.audioUrl} className="h-6 w-full" />}
              </div>
            );
          })}
        </div>
      </div>

      {!result ? (
        <button
          type="button"
          onClick={handleSubmit}
          disabled={pending}
          className={`mt-3 ${STUDENT_BUTTON_PRIMARY}`}
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
