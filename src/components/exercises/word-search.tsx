"use client";

import { useState, useEffect, useMemo, useRef, type CSSProperties } from "react";
import { GridZoomControls } from "./grid-zoom-controls";
import { useGridZoom, keepViewAfterZoom } from "./use-grid-zoom";
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
import { LEGEND_TILE_BASE, LEGEND_IMAGE_GRID, LEGEND_PILL, LEGEND_LONG_CARD } from "./legend-tile-style";
import { HintBulb, type HintBulbState } from "./hint-bulb";
import { resolveClueView } from "./resolve-clue-view";
import { sortByTextLength } from "@/lib/exercises/clue-text-groups";
import { RESULT_MESSAGE_CLASS, SCORE_LABEL_CLASS } from "./score-style";
import { BlockNavigation } from "./block-navigation";
import { hintHighlightCells } from "./word-search-hint-highlight";

type Cell = { row: number; col: number };
type WordSearchBlockResult = Extract<GradeResult, { detail: WordSearchDetail }>;
// ЕТАП J — CSS custom properties (--cols/--zoom) у style= інлайн-об'єкті,
// той самий прийом, що CSSVarStyle у crossword.tsx (ЕТАП I).
type CSSVarStyle = CSSProperties & Record<`--${string}`, string | number>;

// found/hintUsed → стан спільної лампочки (hint-bulb.tsx): знайдено —
// завжди "done" (галочка), незнайдено — "used" (приглушено, підказку вже
// брали) чи "available" (ще ні).
function bulbState(found: boolean, hintUsed: boolean): HintBulbState {
  return found ? "done" : hintUsed ? "used" : "available";
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
      {/* ЕТАП D/E, п.4b/п.2 — декоративна лампочка (підказка доступна) у
          круглій підкладці, зникає коли в слова взагалі немає hintStart і
          воно ще не знайдене; клік обробляє ВСЯ плитка (onHint на div
          вище), бейдж лише декоративний (as="span"). */}
      {(found || word.hintStart) && (
        <HintBulb
          size="md"
          state={bulbState(found, hintUsed)}
          as="span"
          overImage
          className="absolute right-1.5 top-1.5"
        />
      )}
      {hintUsed && (
        <span className="absolute left-1 top-1 rounded bg-amber-100 px-1 text-[10px] italic text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
          з підказкою
        </span>
      )}
    </div>
  );
}

// Пілюля короткої текстової підказки (ЕТАП F, варіант C) — inline-flex у
// спільному flex-wrap рядку (LEGEND_PILL): природно розкладається по рядках
// незалежно від довжини тексту, не фіксована сітка-колонка. Лампочка/
// галочка — зліва в тому самому слоті, тепер круглий бейдж SM (ЕТАП H,
// той самий вигляд, що на картинках і довгих картках, лише менший) —
// однаковий розмір обох станів, тож заміна при знайденому слові не зсуває
// ширину пілюлі; якщо в слова взагалі немає hintStart і воно ще не знайдене
// — слот просто відсутній, лівий відступ лишається симетричним базовим
// px-3 (LEGEND_PILL), інакше звужується до pl-1.5 — щоб коло бейджа сіло
// акуратно без зайвого простору зліва.
function TextPill({
  text,
  audioUrl,
  hintStart,
  found,
  hintUsed,
  onHint,
}: {
  text: string;
  audioUrl?: string;
  hintStart?: { row: number; col: number } | null;
  found: boolean;
  hintUsed: boolean;
  onHint: () => void;
}) {
  const showIcon = found || !!hintStart;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onHint}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onHint();
        }
      }}
      className={`${LEGEND_PILL} ${showIcon ? "pl-1.5 pr-3" : ""} ${found ? "cursor-default opacity-50" : "cursor-pointer"}`}
    >
      {showIcon && <HintBulb size="sm" state={bulbState(found, hintUsed)} as="span" />}
      <span className={`whitespace-normal ${CLUE_TEXT} ${found ? "line-through" : ""}`}>{text}</span>
      {audioUrl && (
        <span onClick={(e) => e.stopPropagation()}>
          <CompactAudioButton src={audioUrl} />
        </span>
      )}
      {hintUsed && (
        <span className="rounded bg-amber-100 px-1 text-[10px] italic text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
          з підказкою
        </span>
      )}
    </div>
  );
}

// Картка довгої підказки-речення (ЕТАП F, варіант C, LEGEND_LONG_CARD) — на
// всю ширину (один стовпець у батьківському flex-col, без 2-колонкової
// сітки), кругла підкладка лампочки зліва (чи в правому верхньому куті,
// якщо є картинка — резерв pr-9, той самий принцип, що в етапі E, лише
// тепер підкладка кругла й кольорова, не "гола" іконка).
function LongCard({
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
  const hasImage = !!word.imageUrl;
  const showBadge = found || !!word.hintStart;
  const badge = showBadge ? (
    <HintBulb
      size="md"
      state={bulbState(found, hintUsed)}
      as="span"
      className={hasImage ? "absolute right-2 top-2" : ""}
    />
  ) : null;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onHint}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onHint();
        }
      }}
      className={`${LEGEND_LONG_CARD} ${hasImage ? "pr-9" : ""} ${
        found ? "cursor-default opacity-50" : "cursor-pointer"
      }`}
    >
      {!hasImage && badge}
      {hasImage && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onZoom();
          }}
          aria-label="Показати картинку повністю"
          className="relative shrink-0 cursor-zoom-in"
        >
          <ImageOrPlaceholder src={word.imageUrl} alt="" className="h-16 w-16 rounded object-cover" useFocus />
        </button>
      )}
      <div className="flex-1 pt-[3px]">
        <span className={`${CLUE_TEXT} ${found ? "line-through" : ""}`}>{word.translation || word.word}</span>
        {word.audioUrl && (
          <div className="mt-1" onClick={(e) => e.stopPropagation()}>
            <CompactAudioButton src={word.audioUrl} />
          </div>
        )}
      </div>
      {hasImage && badge}
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
  cols,
  zoom,
  onResult,
}: {
  taskId: string;
  block: WordSearchPublicBlock;
  blockIndex?: number;
  active: boolean;
  isDelf?: boolean;
  // ЕТАП J — спільні для ВСІХ блоків вправи (рахує/тримає WordSearchExercise):
  // cols — max(gridSize) по всіх блоках (однакова клітинка незалежно від
  // того, який блок менший), zoom — студентський масштаб 1/1.25/1.5/2.
  cols: number;
  zoom: number;
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
  // scrollRef — рівень (2) трирівневої структури (overflow-x-auto), той
  // самий, що scrollRef у crossword.tsx (ЕТАП I2) — на ньому вимірюється
  // переповнення (useScrollOverflowHint) і коригується scrollLeft при
  // зміні zoom (keepViewAfterZoom) чи двопальцевій панорамі.
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollHint = useScrollOverflowHint(scrollRef, active);
  // Слова, для яких клікали підказку — надсилається разом із foundWords
  // (WordSearchAnswer.hintedWords), для 50%-балів при hintsReducePoints.
  const [hintedWords, setHintedWords] = useState<Set<string>>(new Set());

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

  // Визначення клітинки з координат вказівника — завжди через data-row/
  // data-col + elementFromPoint (НЕ через фіксований розмір клітинки),
  // тож працює однаково при будь-якому --cw/zoom.
  function cellFromPoint(x: number, y: number): Cell | null {
    const el = document.elementFromPoint(x, y);
    const target = (el as HTMLElement | null)?.closest("[data-row]") as HTMLElement | null;
    if (!target) return null;
    return { row: Number(target.dataset.row), col: Number(target.dataset.col) };
  }

  // ЕТАП J — прокрутка сітки ДВОМА пальцями: сітка лишається touch-action:
  // none (нативний pinch/scroll вимкнено, замість нього кнопки зуму) —
  // одно-пальцевий дотик і далі виділяє слово (startDrag/moveDrag), другий
  // палець скасовує поточне виділення (без перевірки слова) і переходить у
  // режим панорамування: середня точка двох пальців рухає container.scrollLeft
  // по X і window.scrollBy по Y. Після підняття ОБОХ пальців — кінець
  // панорамування; палець, що лишився один, НЕ починає нового виділення,
  // доки не піднято всі (suppressSelectRef — до pointers.size === 0). Усе
  // відстежується тут-таки (не через React-стан — часта зміна на кожен
  // pointermove, стан був би зайвим ререндером).
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const panningRef = useRef(false);
  const panLastMidRef = useRef<{ x: number; y: number } | null>(null);
  const suppressSelectRef = useRef(false);

  function handleTouchPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "touch") return;
    const pointers = activePointersRef.current;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    e.currentTarget.setPointerCapture(e.pointerId);
    if (pointers.size === 1) {
      if (suppressSelectRef.current) return;
      const cell = cellFromPoint(e.clientX, e.clientY);
      if (cell) startDrag(cell);
    } else if (pointers.size === 2) {
      setDragging(false);
      setDragStart(null);
      setDragEnd(null);
      suppressSelectRef.current = true;
      panningRef.current = true;
      const pts = [...pointers.values()];
      panLastMidRef.current = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
    }
  }

  function handleTouchPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "touch") return;
    const pointers = activePointersRef.current;
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (panningRef.current) {
      const pts = [...pointers.values()];
      if (pts.length < 2) return;
      const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      const prevMid = panLastMidRef.current;
      if (prevMid) {
        const dx = mid.x - prevMid.x;
        const dy = mid.y - prevMid.y;
        const container = scrollRef.current;
        if (container) container.scrollLeft -= dx;
        window.scrollBy(0, -dy);
      }
      panLastMidRef.current = mid;
      return;
    }
    if (pointers.size === 1 && dragging) {
      const cell = cellFromPoint(e.clientX, e.clientY);
      if (cell) moveDrag(cell);
    }
  }

  function handleTouchPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "touch") return;
    const pointers = activePointersRef.current;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) {
      panningRef.current = false;
      panLastMidRef.current = null;
    }
    if (pointers.size === 0) {
      suppressSelectRef.current = false;
    }
  }

  // ЕТАП J — збереження вигляду при зміні zoom (keepViewAfterZoom,
  // use-grid-zoom.ts, той самий принцип, що crossword.tsx): без якоря
  // (філворд не має "активної клітинки" на фокусі) — лишається той самий
  // відсоток ширини контенту в центрі видимої частини.
  const prevMetricsRef = useRef<{ scrollLeft: number; clientWidth: number } | null>(null);
  useEffect(() => {
    const container = scrollRef.current;
    if (container) {
      prevMetricsRef.current = { scrollLeft: container.scrollLeft, clientWidth: container.clientWidth };
    }
  });

  const prevZoomRef = useRef(zoom);
  useEffect(() => {
    const prevZoom = prevZoomRef.current;
    prevZoomRef.current = zoom;
    if (prevZoom === zoom) return;
    const container = scrollRef.current;
    const prevMetrics = prevMetricsRef.current;
    if (!container || !prevMetrics) return;
    keepViewAfterZoom(container, prevMetrics, prevZoom, zoom);
  }, [zoom]);

  const gridSize = block.grid.length;
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

  // Похідний набір клітинок для синього маркера підказки (hintHighlightCells,
  // word-search-hint-highlight.ts) — не окремий стан: перераховується щоразу
  // з hintedWords і актуального "знайдено" (детальніше — коментар у файлі
  // функції). foundWordsSet — ті самі слова, що isFound() визнає знайденими
  // (детальний результат сервера, якщо вже перевірено, інакше клієнтський
  // foundWords), просто у вигляді Set<string> для чистої функції.
  const foundWordsSet = new Set(block.words.filter((w) => isFound(w.word)).map((w) => w.word));
  const hintCells = hintHighlightCells(block.words, hintedWords, foundWordsSet);

  // hintStart — координата ПЕРШОЇ літери слова, порахована на сервері один
  // раз при санітизації (sanitize.ts), не весь шлях розміщення: усі літери
  // сітки й так видимі студенту, тож розкриття лише СТАРТОВОЇ клітинки —
  // менший компроміс, ніж уже наявне повне розкриття в crossword/letter_gaps.
  function triggerHint(w: WordSearchPublicBlock["words"][number]) {
    // Повторний тап по вже підказаному (і ще не знайденому) слову — нічого
    // не робить: без повторного списання балів (hintedWords — Set, і так
    // ідемпотентний) і без зайвого ререндеру підсвічування.
    if (locked || isDelf || isFound(w.word) || !w.hintStart || hintedWords.has(w.word)) return;
    setHintedWords((prev) => new Set(prev).add(w.word));
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
  // ЕТАП F, п.1 — короткі текстові пілюлі (TextPill, і default-режим, і
  // clueMode "short") сортуються за зростанням довжини тексту підказки
  // (sortByTextLength, clue-text-groups.ts) — лише порядок, не окремі сітки:
  // усі пілюлі йдуть в ОДНОМУ flex-wrap рядку, короткі природно першими.
  const textWordsSorted = sortByTextLength(textWords, (w) => w.translation || w.word);
  const textCompactWordsSorted = sortByTextLength(textCompactWords, (w) => w.translation || w.word);
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
        {/* ЕТАП J — та сама 3-рівнева структура, що crossword.tsx (ЕТАП I2,
            grid-zoom-wrap/-inner, globals.css):
            1. grid-zoom-wrap — лише container-type:inline-size, w-full (не
               shrink-to-fit у батьківській flex-колонці з items-center).
            2. scrollRef — overflow-x-auto, w-full, сам touch-скрол;
               touch-action:none і pointer-обробники тут-таки (нижче) —
               нативний pinch/scroll на дотику вимкнено (жест недоступний),
               замість нього кнопки зуму (GridZoomControls) і ручна
               двопальцева панорама (handleTouchPointer*). Мишею/колесом/
               тачпадом overflow-x-auto скролиться нативно як завжди.
            3. grid-zoom-inner — оголошує --cols/--zoom (і через них --cw),
               w-max + mx-auto. */}
        <div className="grid-zoom-wrap w-full min-w-0">
          <div
            ref={scrollRef}
            className="w-full touch-none select-none overflow-x-auto shadow-md"
            onPointerDown={handleTouchPointerDown}
            onPointerMove={handleTouchPointerMove}
            onPointerUp={handleTouchPointerUp}
            onPointerCancel={handleTouchPointerUp}
          >
            <div className="grid-zoom-inner w-max mx-auto" style={{ "--cols": cols, "--zoom": zoom } as CSSVarStyle}>
              {/* border-l/border-t на контейнері + border-r/border-b на кожній
                  клітинці — той самий візуальний ефект, що border-collapse на
                  <table> (суцільні 1px лінії, без подвоєння на межах між
                  клітинками). */}
              <div className="relative">
                <div
                  className="grid border-l border-t border-neutral-200 font-heading font-semibold dark:border-neutral-700"
                  style={{ gridTemplateColumns: `repeat(${gridSize}, var(--cw))` }}
                >
                  {block.grid.flatMap((row, ri) =>
                    row.map((letter, ci) => {
                      // Статичний синій маркер підказки (hintCells, похідний
                      // набір — див. word-search-hint-highlight.ts): кільце
                      // inset, щоб не змінювати розмір клітинки, без анімацій.
                      // Зникає сам, щойно слово знайдене (клітинка випадає з
                      // hintCells) — зелена пілюля знайденого слова (SVG нижче)
                      // і так малюється над сіткою, окремо гасити синій не
                      // потрібно.
                      const isHinted = hintCells.has(cellKey({ row: ri, col: ci }));
                      return (
                        <div
                          key={`${ri}:${ci}`}
                          data-row={ri}
                          data-col={ci}
                          onMouseDown={() => startDrag({ row: ri, col: ci })}
                          onMouseEnter={() => moveDrag({ row: ri, col: ci })}
                          className={`flex aspect-square cursor-pointer items-center justify-center border-b border-r border-neutral-200 text-center dark:border-neutral-700 ${cellClass({ row: ri, col: ci })} ${
                            isHinted
                              ? "bg-blue-100 font-bold text-blue-700 ring-2 ring-inset ring-blue-500 dark:bg-blue-900/50 dark:text-blue-200"
                              : ""
                          }`}
                          style={{ fontSize: "max(0.75rem, calc(var(--cw) * 0.5))" }}
                        >
                          {letter}
                        </div>
                      );
                    })
                  )}
                </div>
                {/* Капсули знайдених слів — SVG-оверлей УСЕРЕДИНІ того самого
                    масштабованого елемента, що сітка (grid-zoom-inner), тож
                    масштабується з нею РАЗОМ: viewBox у координатах "1
                    клітинка = 1 юніт" (не px), width/height 100% —
                    пропорційно будь-якому --cw/zoom, без перерахунку тут. */}
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
          </div>
        </div>

        {scrollHint && (
          <p className={HINT_TEXT}>
            <span className="scroll-hint-fine">Сітка ширша за екран — прокрутіть убік</span>
            <span className="scroll-hint-coarse">Сітка ширша за екран — прокрутіть убік двома пальцями</span>
          </p>
        )}

        {/* Легенда — на всю ширину (той самий принцип, що crossword.tsx:
            ширину секцій підказок НЕ прив'язано до пікселів сітки), не
            flex-wrap по центру. Заголовок+лічильник+прогрес-смужка над
            плитками, картинки й текстові підказки — два окремі grid-и
            рівних колонок (різна щільність: картинки дрібніші за плитку,
            тож більше колонок влазить). */}
        <div className="w-full">
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
                  <div className="flex flex-wrap gap-2">
                    {textWordsSorted.map((w) => (
                      <TextPill
                        key={w.word}
                        text={w.translation || w.word}
                        audioUrl={w.audioUrl}
                        hintStart={w.hintStart}
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
                  <div className="flex flex-col gap-2">
                    {textCardWords.map((w) => (
                      <LongCard
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
                {textCompactWords.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {textCompactWordsSorted.map((w) => (
                      <TextPill
                        key={w.word}
                        text={w.translation || w.word}
                        audioUrl={w.audioUrl}
                        hintStart={w.hintStart}
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

  // ЕТАП J — спільний розмір клітинки для ВСІХ блоків вправи: cols =
  // max(gridSize) по всіх блоках (грід філворду завжди квадратний,
  // word-search-grid.ts: size×size), zoom — спільний (одна й та сама
  // панель +/− незалежно від активного блоку), той самий принцип, що
  // maxCols/zoom у crossword.tsx (ЕТАП I).
  const cols = Math.max(...blocks.map((b) => b.grid.length));
  const { zoom, setZoom } = useGridZoom();

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

      {/* ЕТАП J — панель масштабу сітки (grid-zoom-controls.tsx), той
          самий рядок/розміщення, що в crossword.tsx (ЕТАП I): над
          BlockNavigation, не всередині неї. */}
      <GridZoomControls zoom={zoom} onChange={setZoom} />

      {!useBlocks ? (
        <WordSearchBlockView
          taskId={taskId}
          block={blocks[0]}
          active
          isDelf={isDelf}
          cols={cols}
          zoom={zoom}
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
                cols={cols}
                zoom={zoom}
                onResult={(r) => setBlockResults((prev) => ({ ...prev, [i]: r }))}
              />
            </div>
          ))}
        </BlockNavigation>
      )}
    </div>
  );
}
