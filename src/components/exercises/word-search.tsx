"use client";

import { useState, useEffect, useRef } from "react";
import { Check } from "lucide-react";
import type { WordSearchPublic, WordSearchDetail, WordSearchAnswer, GradeResult } from "@/lib/exercises/types";
import { useExerciseCheck } from "./use-exercise-check";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";
import { pluralizePoints } from "@/lib/pluralize-points";
import { sanitizeInstructionsHtml } from "@/lib/sanitize-instructions-html";
import { ImageOrPlaceholder } from "@/components/image-or-placeholder";
import { ImageLightbox } from "./image-lightbox";
import { CompactAudioButton } from "./compact-audio-button";
import { sanitizeWordForGrid } from "@/lib/exercises/grid-word";
import { STUDENT_BUTTON_PRIMARY } from "@/lib/button-styles";
import { EXERCISE_INSTRUCTION, EXERCISE_SUBINSTRUCTION, CLUE_TEXT } from "@/lib/typography-styles";
import { EXERCISE_STACK } from "@/lib/spacing";

type Cell = { row: number; col: number };

// Максимум клітинки на десктопі — 40px для невеликих сіток (до 10×10, де є
// запас місця), інакше 36px (WORD_SEARCH_MAX_GRID=15 — найщільніший
// випадок). MIN_CELL_PX — підлога на вузьких екранах, нижче якої літери вже
// нечитабельні; після неї сітка вмикає власний internal-скрол
// (overflow-x-auto на обгортці), а не стискається далі.
const MIN_CELL_PX = 20;
function maxCellPx(gridSize: number): number {
  return gridSize <= 10 ? 40 : 36;
}

// Маленька зелена галочка в куті плитки (текстової чи картинкової) —
// спільна для обох, absolute всередині відносно позиціонованого батька.
function FoundBadge() {
  return (
    <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-white">
      <Check size={10} strokeWidth={3} />
    </span>
  );
}

// Картка-картинка — квадратна (aspect-square), картинка займає ВСЮ плитку
// (object-cover з точкою фокусу), клік — лайтбокс, як і раніше. Аудіо (якщо
// є) — окремим рядком під картинкою В ТІЙ САМІЙ плитці (не чіпаємо саму
// CompactAudioButton, лише її оточення) — тоді плитка вже не строго
// квадратна, це прийнятний виняток для рідкісної комбінації картинка+аудіо.
// Приглушення (opacity-50) — лише на самій КАРТИНЦІ, не на всій плитці: і
// підпис-слово, і зелена галочка (обидва — сусідні елементи картинки, не
// всередині її ж opacity) лишаються чіткими.
function ImageTile({
  word,
  found,
  onZoom,
}: {
  word: WordSearchPublic["words"][number];
  found: boolean;
  onZoom: () => void;
}) {
  return (
    <div className="relative flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-neutral-700 dark:bg-neutral-800">
      <button
        type="button"
        onClick={onZoom}
        aria-label="Показати картинку повністю"
        className="relative aspect-square cursor-zoom-in"
      >
        <ImageOrPlaceholder
          src={word.imageUrl}
          alt=""
          className={`h-full w-full object-cover transition-opacity ${found ? "opacity-50" : ""}`}
          useFocus
        />
        {/* Підпис-слово при знайденому — оригінал (w.word, з артиклем/
            дефісом як у конфігу), не переклад: студент і так шукав саме це
            слово в сітці. */}
        {found && (
          <span className="absolute inset-x-0 bottom-0 truncate bg-white/85 px-1 py-0.5 text-center font-heading text-xs font-semibold dark:bg-neutral-900/80">
            {word.word}
          </span>
        )}
      </button>
      {word.audioUrl && (
        <div className="flex justify-center p-1">
          <CompactAudioButton src={word.audioUrl} />
        </div>
      )}
      {found && <FoundBadge />}
    </div>
  );
}

// Картка-текст — компактна плитка під ширину тексту (не фіксована ширина
// колонки), текст переноситься всередині (CLUE_TEXT), без тіні (лише тонка
// рамка) — на відміну від попереднього варіанту легенди.
function TextTile({ text, audioUrl, found }: { text: string; audioUrl?: string; found: boolean }) {
  return (
    <div
      className={`relative flex flex-col items-center justify-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-center transition-opacity dark:border-neutral-700 dark:bg-neutral-800 ${
        found ? "opacity-50" : ""
      }`}
    >
      <span className={`${CLUE_TEXT} ${found ? "line-through" : ""}`}>{text}</span>
      {audioUrl && <CompactAudioButton src={audioUrl} />}
      {found && <FoundBadge />}
    </div>
  );
}

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
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
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
        // sanitizeWordForGrid — те саме прибирання пробілів/апострофів/
        // дефісів, що й у генераторі сітки/gradeWordSearch: w.word лишається
        // оригіналом ("grand-mère"), а в клітинках сітки таких символів
        // немає взагалі, тож звірка без нормалізації ніколи не збіглась би.
        const match = config.words.find((w) => {
          if (foundWords.has(w.word)) return false;
          const sanitized = sanitizeWordForGrid(w.word).toUpperCase();
          return sanitized === letters || sanitized === reversed;
        });
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

  const gridSize = config.grid.length;
  // Спільна ширина для обгортки сітки й легенди під нею (вирівнювання по
  // сітці замість flex-wrap по центру, п.1).
  const gridMaxWidthPx = gridSize * maxCellPx(gridSize);
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

  // Картинка ПРІОРИТЕТНІША за переклад (як і в hintKind до попередніх
  // ітерацій цієї легенди) — слово потрапляє або в imageWords, або в
  // textWords, ніколи в обидва.
  const imageWords = config.words.filter((w) => !!w.imageUrl);
  const textWords = config.words.filter((w) => !w.imageUrl);
  const foundCount = config.words.filter((w) => isFound(w.word)).length;
  const totalWords = config.words.length;
  const allFound = totalWords > 0 && foundCount === totalWords;
  const progressPercent = totalWords > 0 ? (foundCount / totalWords) * 100 : 0;

  function handleSubmit() {
    const answer: WordSearchAnswer = [...foundWords.entries()].map(([word, cells]) => ({
      word,
      cells,
    }));
    submit(answer);
  }

  return (
    <div className={EXERCISE_STACK}>
      <div>
        <div className="flex flex-wrap items-baseline gap-2">
          <div
            className={`instruction-text ${EXERCISE_INSTRUCTION}`}
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
            className={`mt-1 ${EXERCISE_SUBINSTRUCTION}`}
            dangerouslySetInnerHTML={{ __html: sanitizeInstructionsHtml(config.subInstructions) }}
          />
        )}
      </div>

      {/* Вертикальна розкладка на всіх ширинах (не flex-wrap "поруч/під") —
          той самий принцип компонування, що crossword.tsx: сітка по центру
          зверху, легенда під нею, відступ між ними — той самий ритм
          (gap-4 md:gap-6), що EXERCISE_STACK на корені (spacing.ts). */}
      <div className="flex flex-col items-center gap-4 md:gap-6">
        {/* [container-type:inline-size] — контейнер для cqi нижче (шрифт
            літери масштабується РАЗОМ ІЗ РЕАЛЬНОЮ шириною клітинки, не
            фіксованим брейкпоінтом). maxWidth капає розмір клітинки на
            десктопі (40px для сіток до 10×10, інакше 36px); колонки грід
            нижче (minmax(20px,1fr)) стискаються рівномірно на вузьких
            екранах аж до підлоги 20px — після неї вмикається internal-
            скрол (overflow-x-auto тут-таки), сторінка сама НЕ скролиться
            горизонтально. Той самий gridMaxWidthPx нижче задає ширину
            легенди — вирівняну по лівому/правому краю сітки. */}
        <div
          ref={gridRef}
          className="w-full touch-none select-none overflow-x-auto shadow-md [container-type:inline-size]"
          style={{ maxWidth: `${gridMaxWidthPx}px` }}
          onTouchMove={(e) => {
            const cell = cellFromTouch(e.touches[0]);
            if (cell) moveDrag(cell);
          }}
        >
          {/* border-l/border-t на контейнері + border-r/border-b на кожній
              клітинці — той самий візуальний ефект, що border-collapse на
              <table> раніше (суцільні 1px лінії, без подвоєння на межах між
              клітинками), лише тепер на CSS grid (не table), бо тільки grid
              підтримує minmax(min,max) на колонках для флюїдного розміру. */}
          <div
            className="grid border-l border-t border-neutral-200 font-heading font-semibold dark:border-neutral-700"
            style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(${MIN_CELL_PX}px, 1fr))` }}
          >
            {config.grid.flatMap((row, ri) =>
              row.map((letter, ci) => (
                <div
                  key={`${ri}:${ci}`}
                  data-row={ri}
                  data-col={ci}
                  onMouseDown={() => startDrag({ row: ri, col: ci })}
                  onMouseEnter={() => moveDrag({ row: ri, col: ci })}
                  onTouchStart={() => startDrag({ row: ri, col: ci })}
                  className={`flex aspect-square cursor-pointer items-center justify-center border-b border-r border-neutral-200 text-center dark:border-neutral-700 ${cellClass({ row: ri, col: ci })}`}
                  style={{ fontSize: `clamp(10px, ${45 / gridSize}cqi, ${maxCellPx(gridSize) * 0.5}px)` }}
                >
                  {letter}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Легенда — та сама ширина/вирівнювання, що сітка (gridMaxWidthPx),
            не flex-wrap по центру. Заголовок+лічильник+прогрес-смужка над
            плитками, картинки й текстові підказки — два окремі grid-и
            рівних колонок (різна щільність: картинки дрібніші за плитку,
            тож більше колонок влазить). */}
        <div className="w-full" style={{ maxWidth: `${gridMaxWidthPx}px` }}>
          <div className="flex items-baseline justify-between">
            <span className="font-heading text-sm text-neutral-500 dark:text-neutral-400">Знайдіть слова</span>
            <span
              className={`font-heading text-sm font-semibold tabular-nums ${
                allFound ? "text-green-600 dark:text-green-400" : ""
              }`}
            >
              {foundCount} з {totalWords}
            </span>
          </div>
          <div className="mt-1 h-1 w-full rounded-full bg-neutral-200 dark:bg-neutral-700">
            <div
              className="h-1 rounded-full bg-green-500 transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="mt-3 flex flex-col gap-2">
            {imageWords.length > 0 && (
              <div className="grid grid-cols-4 gap-2 md:grid-cols-6">
                {imageWords.map((w) => (
                  <ImageTile
                    key={w.word}
                    word={w}
                    found={isFound(w.word)}
                    onZoom={() => setLightboxSrc(w.imageUrl!)}
                  />
                ))}
              </div>
            )}
            {textWords.length > 0 && (
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                {textWords.map((w) => (
                  <TextTile
                    key={w.word}
                    text={w.translation || w.word}
                    audioUrl={w.audioUrl}
                    found={isFound(w.word)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

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

      {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
    </div>
  );
}
