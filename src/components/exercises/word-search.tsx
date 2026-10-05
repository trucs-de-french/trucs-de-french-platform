"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Check } from "lucide-react";
import type {
  WordSearchPublic,
  WordSearchPublicBlock,
  WordSearchDetail,
  WordSearchAnswer,
  GradeResult,
} from "@/lib/exercises/types";
import { useExerciseCheck } from "./use-exercise-check";
import { useScrollOverflowHint } from "./use-scroll-overflow-hint";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";
import { pluralizePoints } from "@/lib/pluralize-points";
import { sanitizeInstructionsHtml } from "@/lib/sanitize-instructions-html";
import { ImageOrPlaceholder } from "@/components/image-or-placeholder";
import { ImageLightbox } from "./image-lightbox";
import { CompactAudioButton } from "./compact-audio-button";
import { sanitizeWordForGrid } from "@/lib/exercises/grid-word";
import { HintExplanation } from "./hint-explanation";
import { STUDENT_BUTTON_PRIMARY } from "@/lib/button-styles";
import { EXERCISE_INSTRUCTION, EXERCISE_SUBINSTRUCTION, CLUE_TEXT, HINT_TEXT } from "@/lib/typography-styles";
import { EXERCISE_STACK } from "@/lib/spacing";
import { LEGEND_TILE_BASE, LEGEND_TILE_GRID, LEGEND_IMAGE_GRID, LEGEND_TILE_GRID_WIDE } from "./legend-tile-style";
import { resolveClueView } from "./resolve-clue-view";
import { RESULT_MESSAGE_CLASS, SCORE_LABEL_CLASS } from "./score-style";
import { BlockNavigation } from "./block-navigation";

type Cell = { row: number; col: number };
type WordSearchBlockResult = Extract<GradeResult, { detail: WordSearchDetail }>;

// Максимум клітинки на десктопі — 40px для невеликих сіток (до 10×10, де є
// запас місця), інакше 36px (WORD_SEARCH_MAX_GRID=15 — найщільніший
// випадок). MIN_CELL_PX — підлога на вузьких екранах, нижче якої літери вже
// нечитабельні; після неї сітка вмикає власний internal-скрол
// (overflow-x-auto на обгортці), а не стискається далі. Рахується за
// розміром САМЕ ЦЬОГО блоку (split-into-blocks.ts: типово ≤12×12, зрідка
// більше для довгого слова) — не всієї вправи, тож майже завжди в межах
// 40px-гілки.
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
// onHint — клік по плитці ЦІЛОМУ (не лише по картинці) блимає першою
// літерою слова в сітці; кнопка "лупа" (onZoom) і аудіо-кнопка всередині
// самі зупиняють спливання (stopPropagation), інакше кожен їхній клік теж
// рахувався б підказкою.
function ImageTile({
  word,
  found,
  hintUsed,
  onZoom,
  onHint,
}: {
  word: WordSearchPublicBlock["words"][number];
  found: boolean;
  hintUsed: boolean;
  onZoom: () => void;
  onHint: () => void;
}) {
  return (
    <div
      onClick={onHint}
      className={`flex flex-col overflow-hidden ${LEGEND_TILE_BASE} ${
        found ? "cursor-default" : "cursor-pointer"
      }`}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onZoom();
        }}
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
        <div className="flex justify-center p-1" onClick={(e) => e.stopPropagation()}>
          <CompactAudioButton src={word.audioUrl} />
        </div>
      )}
      {found && <FoundBadge />}
      {hintUsed && (
        <span className="absolute left-1 top-1 rounded bg-amber-100 px-1 text-[10px] italic text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
          з підказкою
        </span>
      )}
    </div>
  );
}

// Картка-текст — компактна плитка під ширину тексту (не фіксована ширина
// колонки), текст переноситься всередині (CLUE_TEXT), без тіні (лише тонка
// рамка) — на відміну від попереднього варіанту легенди.
function TextTile({
  text,
  audioUrl,
  found,
  hintUsed,
  onHint,
}: {
  text: string;
  audioUrl?: string;
  found: boolean;
  hintUsed: boolean;
  onHint: () => void;
}) {
  return (
    <div
      onClick={onHint}
      className={`flex flex-col items-center justify-center gap-1 px-3 py-2 text-center transition-opacity ${LEGEND_TILE_BASE} ${
        found ? "cursor-default opacity-50" : "cursor-pointer"
      }`}
    >
      <span className={`${CLUE_TEXT} ${found ? "line-through" : ""}`}>{text}</span>
      {audioUrl && (
        <div onClick={(e) => e.stopPropagation()}>
          <CompactAudioButton src={audioUrl} />
        </div>
      )}
      {found && <FoundBadge />}
      {hintUsed && (
        <span className="absolute left-1 top-1 rounded bg-amber-100 px-1 text-[10px] italic text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
          з підказкою
        </span>
      )}
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

// Один блок — власна сітка, власна легенда, власний стан (виділення/
// підказки/перевірка) — НІКОЛИ не розмонтовується при перемиканні вкладок
// (WordSearchExercise ховає неактивні через className "hidden", не
// умовний рендер) саме для того, щоб цей стан не губився. blockIndex
// undefined — вправа з ОДНИМ блоком (стара або щойно згенерована): позначка
// в WordSearchAnswer не надсилається взагалі (байтова відповідність
// поведінці до появи блоків), кнопка "Перевірити" без варіанту "ще раз".
function WordSearchBlockView({
  taskId,
  block,
  blockIndex,
  active,
  isDelf,
  onResult,
}: {
  taskId: string;
  block: WordSearchPublicBlock;
  blockIndex?: number;
  active: boolean;
  isDelf?: boolean;
  onResult: (result: WordSearchBlockResult) => void;
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
  const scrollHint = useScrollOverflowHint(gridRef, active);
  // Слова, для яких клікали підказку — надсилається разом із foundWords
  // (WordSearchAnswer.hintedWords), для 50%-балів при hintsReducePoints.
  const [hintedWords, setHintedWords] = useState<Set<string>>(new Set());
  // nonce — щоб клік по тій самій плитці вдруге теж перезапускав CSS-
  // анімацію (React інакше не перемонтував би вже завершений DOM-вузол).
  // Лічильник у ref (не Date.now() — react-hooks/purity забороняє нечисті
  // виклики під час рендеру, а ref можна безпечно змінювати в обробнику
  // подій), просто зростає з кожним кліком підказки.
  const [blink, setBlink] = useState<{ row: number; col: number; nonce: number } | null>(null);
  const blinkNonceRef = useRef(0);

  const { submit, pending, result, error } = useExerciseCheck(taskId);
  const detail = result?.detail as WordSearchDetail | undefined;
  const locked = !!result;
  const allowRecheck = blockIndex !== undefined;

  useEffect(() => {
    if (result) onResult(result as WordSearchBlockResult);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

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
        const letters = path.map((c) => block.grid[c.row][c.col]).join("");
        const reversed = [...letters].reverse().join("");
        // sanitizeWordForGrid — те саме прибирання пробілів/апострофів/
        // дефісів, що й у генераторі сітки/gradeWordSearch: w.word лишається
        // оригіналом ("grand-mère"), а в клітинках сітки таких символів
        // немає взагалі, тож звірка без нормалізації ніколи не збіглась би.
        const match = block.words.find((w) => {
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

  const gridSize = block.grid.length;
  // Спільна ширина для обгортки сітки й легенди під нею (вирівнювання по
  // сітці замість flex-wrap по центру, п.1).
  const gridMaxWidthPx = gridSize * maxCellPx(gridSize);
  const previewPath = dragging && dragStart && dragEnd ? buildPath(dragStart, dragEnd) : [];
  const previewKeys = new Set(previewPath.map(cellKey));

  // Знайдені слова більше не зафарбовують клітинки тут — їх показує SVG-
  // капсула (оверлей нижче), піднята НАД сіткою.
  function cellClass(cell: Cell) {
    const key = cellKey(cell);
    if (previewKeys.has(key)) return "bg-blue-200 dark:bg-blue-800";
    return "";
  }

  function isFound(word: string): boolean {
    if (detail) return detail.words.find((d) => d.word === word)?.found ?? false;
    return foundWords.has(word);
  }

  function wordHintUsed(word: string): boolean {
    return detail?.words.find((d) => d.word === word)?.hintUsed ?? false;
  }

  // hintStart — координата ПЕРШОЇ літери слова, порахована на сервері один
  // раз при санітизації (sanitize.ts), не весь шлях розміщення: усі літери
  // сітки й так видимі студенту, тож розкриття лише СТАРТОВОЇ клітинки —
  // менший компроміс, ніж уже наявне повне розкриття в crossword/letter_gaps.
  function triggerHint(w: WordSearchPublicBlock["words"][number]) {
    if (locked || isDelf || isFound(w.word) || !w.hintStart) return;
    setHintedWords((prev) => new Set(prev).add(w.word));
    blinkNonceRef.current += 1;
    setBlink({ row: w.hintStart.row, col: w.hintStart.col, nonce: blinkNonceRef.current });
  }

  // Картинка ПРІОРИТЕТНІША за переклад (як і в hintKind до попередніх
  // ітерацій цієї легенди) — слово потрапляє або в imageWords, або в
  // textWords, ніколи в обидва.
  const imageWords = block.words.filter((w) => !!w.imageUrl);
  const textWords = block.words.filter((w) => !w.imageUrl);
  // clueMode заданий (ЕТАП A/3) — переозначає вигляд УСІХ слів блоку
  // (resolveClueView, resolve-clue-view.ts) замість imageWords/textWords
  // вище (ті лишаються для гілки без clueMode, нижче в JSX).
  const clueMode = block.clueMode;
  const clueViews = clueMode ? block.words.map((w) => ({ w, view: resolveClueView(clueMode, w) })) : [];
  const imageCardWords = clueViews.filter((v) => v.view === "image-card").map((v) => v.w);
  const textCardWords = clueViews.filter((v) => v.view === "text-card").map((v) => v.w);
  const textCompactWords = clueViews.filter((v) => v.view === "text-compact").map((v) => v.w);
  const foundCount = block.words.filter((w) => isFound(w.word)).length;
  const totalWords = block.words.length;
  const allFound = totalWords > 0 && foundCount === totalWords;
  const progressPercent = totalWords > 0 ? (foundCount / totalWords) * 100 : 0;

  function handleSubmit() {
    const answer: WordSearchAnswer = {
      found: [...foundWords.entries()].map(([word, cells]) => ({ word, cells })),
      hintedWords: [...hintedWords],
      ...(blockIndex !== undefined ? { blockIndex } : {}),
    };
    submit(answer);
  }

  return (
    <div className="flex flex-col gap-4">
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
            легенди — вирівняну по лівому/правому краю сітки. touch-none —
            ЛИШЕ на цьому контейнері (сітка), не на сторінці: жест-скрол
            вертикально сторінкою лишається вільним поза сіткою. */}
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
          <div className="relative">
            <div
              className="grid border-l border-t border-neutral-200 font-heading font-semibold dark:border-neutral-700"
              style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(${MIN_CELL_PX}px, 1fr))` }}
            >
              {block.grid.flatMap((row, ri) =>
                row.map((letter, ci) => {
                  const isBlinking = blink?.row === ri && blink?.col === ci;
                  return (
                    <div
                      // nonce у key — лише для клітинки, що блимає ЗАРАЗ:
                      // React перемонтовує вузол при повторному кліку на ту
                      // саму підказку, інакше вже завершена (iteration-count:
                      // 3, не infinite) CSS-анімація не перезапустилась би на
                      // тому самому DOM-елементі.
                      key={isBlinking ? `${ri}:${ci}:${blink.nonce}` : `${ri}:${ci}`}
                      data-row={ri}
                      data-col={ci}
                      onMouseDown={() => startDrag({ row: ri, col: ci })}
                      onMouseEnter={() => moveDrag({ row: ri, col: ci })}
                      onTouchStart={() => startDrag({ row: ri, col: ci })}
                      className={`flex aspect-square cursor-pointer items-center justify-center border-b border-r border-neutral-200 text-center dark:border-neutral-700 ${cellClass({ row: ri, col: ci })} ${isBlinking ? "animate-hint-blink" : ""}`}
                      style={{ fontSize: `clamp(10px, ${45 / gridSize}cqi, ${maxCellPx(gridSize) * 0.5}px)` }}
                    >
                      {letter}
                    </div>
                  );
                })
              )}
            </div>
            {/* Капсули знайдених слів — SVG-оверлей у координатах "1 клітинка
                = 1 юніт viewBox" (детальний опис геометрії — без змін від
                попередньої, одноблочної версії). */}
            <svg
              viewBox={`0 0 ${gridSize} ${gridSize}`}
              className="pointer-events-none absolute inset-0 h-full w-full"
            >
              {[...foundWords.entries()].map(([word, cells]) => {
                if (cells.length === 0) return null;
                const start = cells[0];
                const end = cells[cells.length - 1];
                const x1 = start.col + 0.5;
                const y1 = start.row + 0.5;
                const x2 = end.col + 0.5;
                const y2 = end.row + 0.5;
                return (
                  <g key={word}>
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke="var(--found-word)"
                      strokeOpacity="var(--found-word-fill-opacity)"
                      strokeWidth={0.7}
                      strokeLinecap="round"
                    />
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke="var(--found-word)"
                      strokeOpacity={0.55}
                      strokeWidth={0.56}
                      strokeLinecap="round"
                    />
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {scrollHint && <p className={HINT_TEXT}>Сітка ширша за екран — прокрутіть убік</p>}

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
            {!block.clueMode ? (
              // clueMode не заданий — ІСНУЮЧА (до ЕТАПУ A) гілка без змін:
              // картинка пріоритетніша за переклад, picked вище в
              // imageWords/textWords.
              <>
                {imageWords.length > 0 && (
                  <div className={LEGEND_IMAGE_GRID}>
                    {imageWords.map((w) => (
                      <ImageTile
                        key={w.word}
                        word={w}
                        found={isFound(w.word)}
                        hintUsed={wordHintUsed(w.word)}
                        onZoom={() => setLightboxSrc(w.imageUrl!)}
                        onHint={() => triggerHint(w)}
                      />
                    ))}
                  </div>
                )}
                {textWords.length > 0 && (
                  <div className={LEGEND_TILE_GRID}>
                    {textWords.map((w) => (
                      <TextTile
                        key={w.word}
                        text={w.translation || w.word}
                        audioUrl={w.audioUrl}
                        found={isFound(w.word)}
                        hintUsed={wordHintUsed(w.word)}
                        onHint={() => triggerHint(w)}
                      />
                    ))}
                  </div>
                )}
              </>
            ) : (
              // clueMode заданий — переозначає вигляд УСІХ слів блоку
              // (imageCardWords/textCardWords/textCompactWords, пораховані
              // вище через resolveClueView), незалежно від власної картинки
              // слова (крім фолбеку "image" без картинки).
              <>
                {imageCardWords.length > 0 && (
                  <div className={LEGEND_IMAGE_GRID}>
                    {imageCardWords.map((w) => (
                      <ImageTile
                        key={w.word}
                        word={w}
                        found={isFound(w.word)}
                        hintUsed={wordHintUsed(w.word)}
                        onZoom={() => setLightboxSrc(w.imageUrl!)}
                        onHint={() => triggerHint(w)}
                      />
                    ))}
                  </div>
                )}
                {textCardWords.length > 0 && (
                  <div className={LEGEND_TILE_GRID_WIDE}>
                    {textCardWords.map((w) => (
                      <TextTile
                        key={w.word}
                        text={w.translation || w.word}
                        audioUrl={w.audioUrl}
                        found={isFound(w.word)}
                        hintUsed={wordHintUsed(w.word)}
                        onHint={() => triggerHint(w)}
                      />
                    ))}
                  </div>
                )}
                {textCompactWords.length > 0 && (
                  <div className={LEGEND_TILE_GRID}>
                    {textCompactWords.map((w) => (
                      <TextTile
                        key={w.word}
                        text={w.translation || w.word}
                        audioUrl={w.audioUrl}
                        found={isFound(w.word)}
                        hintUsed={wordHintUsed(w.word)}
                        onHint={() => triggerHint(w)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {allowRecheck ? (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={pending}
              className={STUDENT_BUTTON_PRIMARY}
            >
              {pending ? "Перевіряю..." : result ? "Перевірити ще раз" : "Перевірити блок"}
            </button>
            {result && (
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
          </div>
        ) : !result ? (
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

      {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
    </div>
  );
}

export function WordSearchExercise({
  taskId,
  config,
  pointsVisible,
  onResult,
  hidePoints,
  isDelf,
}: {
  taskId: string;
  config: WordSearchPublic;
  pointsVisible: boolean;
  onResult?: (result: GradeResult) => void;
  hidePoints?: boolean;
  // Задача належить DELF-тесту — клік по легенді більше не підсвічує
  // першу літеру (triggerHint у WordSearchBlockView).
  isDelf?: boolean;
}) {
  // Фолбек на п.5 ЕТАПУ 3/4 — blocks відсутній/порожній (помилка даних,
  // нормалізатор на сервері мав би це виключити, але тут про всяк випадок,
  // без падіння): показуємо вправу як один блок із LEGACY-полів верхнього
  // рівня (config.words/config.grid — ЩЕ не видалені з Public саме через
  // цей фолбек, п.7 звіту).
  const blocks: WordSearchPublicBlock[] =
    config.blocks.length > 0 ? config.blocks : [{ words: config.words, grid: config.grid }];
  const blockCount = blocks.length;
  const useBlocks = blockCount > 1;
  const [activeBlock, setActiveBlock] = useState(0);
  const [blockResults, setBlockResults] = useState<Record<number, WordSearchBlockResult>>({});

  // ==== Гілка з ОДНИМ блоком (стара поведінка, незмінна) ====
  const [singleResult, setSingleResult] = useState<WordSearchBlockResult | null>(null);
  useEffect(() => {
    if (!useBlocks && singleResult) onResult?.(singleResult);
  }, [useBlocks, singleResult, onResult]);

  // ==== Гілка з кількома блоками ====
  const allBlocksChecked = useBlocks && blockCount > 0 && Object.keys(blockResults).length === blockCount;

  // Сумарний результат — той самий принцип, що matching.tsx/letter-gaps.tsx:
  // лише коли ВСІ блоки перевірені хоч раз; повторна перевірка вже
  // пройденого блоку оновлює лише його запис, useMemo перераховує суму.
  const aggregateResult: WordSearchBlockResult | null = useMemo(() => {
    if (!allBlocksChecked) return null;
    const results = Object.values(blockResults);
    const words = results.flatMap((r) => r.detail.words);
    const foundCount = words.filter((w) => w.found).length;
    return {
      correct: results.every((r) => r.correct),
      score: words.length > 0 ? Math.round((foundCount / words.length) * 100) : 0,
      detail: { words },
      pointsEarned: results.reduce((sum, r) => sum + (r.pointsEarned ?? 0), 0),
      pointsPossible: results.reduce((sum, r) => sum + (r.pointsPossible ?? 0), 0),
    };
  }, [allBlocksChecked, blockResults]);

  useEffect(() => {
    if (aggregateResult) onResult?.(aggregateResult);
  }, [aggregateResult, onResult]);

  const hintExplanationHidden = !!isDelf || (useBlocks ? allBlocksChecked : !!singleResult);

  return (
    <div className={EXERCISE_STACK}>
      <div>
        <div className="flex flex-wrap items-baseline gap-2">
          <div
            className={`instruction-text ${EXERCISE_INSTRUCTION}`}
            dangerouslySetInnerHTML={{
              __html: sanitizeInstructionsHtml(config.instructions ?? DEFAULT_INSTRUCTIONS.word_search.instruction),
            }}
          />
          {!hidePoints && (pointsVisible || (useBlocks ? aggregateResult : singleResult)) && (
            <span className={SCORE_LABEL_CLASS}>
              {useBlocks
                ? aggregateResult
                  ? `${aggregateResult.pointsEarned}/${config.points} ${pluralizePoints(config.points)}`
                  : `${config.points} ${pluralizePoints(config.points)}`
                : singleResult
                  ? `${singleResult.correct ? config.points : 0}/${config.points} ${pluralizePoints(config.points)}`
                  : `${config.points} ${pluralizePoints(config.points)}`}
            </span>
          )}
        </div>
        {(config.subInstructions ?? DEFAULT_INSTRUCTIONS.word_search.subInstruction) && (
          <div
            className={`mt-1 ${EXERCISE_SUBINSTRUCTION}`}
            dangerouslySetInnerHTML={{
              __html: sanitizeInstructionsHtml(config.subInstructions ?? DEFAULT_INSTRUCTIONS.word_search.subInstruction),
            }}
          />
        )}
      </div>

      <HintExplanation type="word_search" hintsReducePoints={config.hintsReducePoints} hidden={hintExplanationHidden} />

      {!useBlocks ? (
        <WordSearchBlockView
          taskId={taskId}
          block={blocks[0]}
          active
          isDelf={isDelf}
          onResult={setSingleResult}
        />
      ) : (
        <BlockNavigation
          blockCount={blockCount}
          activeBlock={activeBlock}
          onChangeBlock={setActiveBlock}
          isBlockChecked={(i) => i in blockResults}
          summary={aggregateResult}
          labels={blocks.map((b) => b.title)}
        >
          {/* Усі блоки змонтовані одразу — неактивні лише приховані класом
              "hidden" (display:none), НЕ умовним рендером: кожен
              WordSearchBlockView тримає власний стан (foundWords/
              hintedWords/drag/pending-результат), його не можна втратити
              при перемиканні вкладок. active — лише цьому, видимому зараз
              блоку дозволено вимірювати переповнення сітки
              (useScrollOverflowHint) — немонтований display:none контейнер
              дав би хибний (нульовий) вимір. */}
          {blocks.map((b, i) => (
            <div key={i} className={i === activeBlock ? "" : "hidden"}>
              <WordSearchBlockView
                taskId={taskId}
                block={b}
                blockIndex={i}
                active={i === activeBlock}
                isDelf={isDelf}
                onResult={(r) => setBlockResults((prev) => ({ ...prev, [i]: r }))}
              />
            </div>
          ))}
        </BlockNavigation>
      )}
    </div>
  );
}
