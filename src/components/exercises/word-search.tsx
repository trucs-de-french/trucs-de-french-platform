"use client";

import { useState, useEffect, useRef } from "react";
import type { WordSearchPublic, WordSearchDetail, WordSearchAnswer, GradeResult } from "@/lib/exercises/types";
import { useExerciseCheck } from "./use-exercise-check";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";
import { pluralizePoints } from "@/lib/pluralize-points";
import { sanitizeInstructionsHtml } from "@/lib/sanitize-instructions-html";

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

  function wordLabelClass(word: string) {
    if (detail) {
      const w = detail.words.find((d) => d.word === word);
      return w?.found
        ? "text-green-600 line-through dark:text-green-400"
        : "text-red-600 dark:text-red-400";
    }
    return foundWords.has(word) ? "text-green-600 line-through dark:text-green-400" : "";
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

      <div className="mb-3 flex flex-wrap gap-x-3 gap-y-1">
        {config.words.map((w) => (
          <span key={w.word} className={`text-sm ${wordLabelClass(w.word)}`}>
            {w.word}
          </span>
        ))}
      </div>

      <div
        ref={gridRef}
        className="inline-block touch-none select-none"
        onTouchMove={(e) => {
          const cell = cellFromTouch(e.touches[0]);
          if (cell) moveDrag(cell);
        }}
      >
        <table className="border-collapse font-mono text-sm">
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
                    className={`h-7 w-7 cursor-pointer border border-neutral-200 text-center dark:border-neutral-700 ${cellClass({ row: ri, col: ci })}`}
                  >
                    {letter}
                  </td>
                ))}
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
