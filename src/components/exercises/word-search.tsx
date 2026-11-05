"use client";

import { useState, useEffect, useMemo, useRef, useId, type CSSProperties } from "react";
import { GridZoomControls } from "./grid-zoom-controls";
import { useGridZoom, keepViewAfterZoom, applyPinchFocal } from "./use-grid-zoom";
import { usePinchZoom, useIsMobilePinchViewport } from "./use-pinch-zoom";
import { GridScrollSlider } from "./grid-scroll-slider";
import type {
  WordSearchPublic,
  WordSearchPublicBlock,
  WordSearchDetail,
  WordSearchAnswer,
  GradeResult,
} from "@/lib/exercises/types";
import { useExerciseCheck } from "./use-exercise-check";
import { useScrollOverflowHint } from "./use-scroll-overflow-hint";
import { DEFAULT_INSTRUCTIONS, DEFAULT_TRANSLATION_EN, taskTranslationLine } from "@/lib/exercises/default-instructions";
import { frenchNbsp } from "@/lib/text/french-typography";
import { ImageOrPlaceholder } from "@/components/image-or-placeholder";
import { ImageLightbox } from "./image-lightbox";
import { CompactAudioButton } from "./compact-audio-button";
import { sanitizeWordForGrid } from "@/lib/exercises/grid-word";
import { hintExplanationText } from "./hint-explanation";
import { TaskPanelHeader } from "./task-panel-header";
import { BUTTON_CHECK } from "@/lib/button-styles";
import { CLUE_TEXT, HINT_TEXT } from "@/lib/typography-styles";
import { EXERCISE_STACK } from "@/lib/spacing";
import { LEGEND_TILE_BASE, LEGEND_IMAGE_GRID, LEGEND_PILL, LEGEND_LONG_CARD } from "./legend-tile-style";
import { HintBulb, type HintBulbState } from "./hint-bulb";
import { resolveClueView } from "./resolve-clue-view";
import { sortByTextLength } from "@/lib/exercises/clue-text-groups";
import { TaskResult, ChevronIcon } from "./task-result";
import { headerPointsState } from "@/lib/exercises/header-points";
import { useCheckConfirm, CheckConfirmBar } from "./check-confirm";
import { BlockNavigation, BlockNavFooter, BlockTabs } from "./block-navigation";
import { useT } from "@/lib/i18n/context";
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

// Галочка знайденого слова в тоглі "Правильні відповіді" — та сама форма,
// що TabCheckIcon (block-navigation.tsx), колір через task-result-answer-num
// (той самий золотий), перефарбована в зелений класом ws-answer-check.
function WsAnswerCheck() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="ws-answer-check"
    >
      <path d="M3 8.5 6.5 12 13 4" />
    </svg>
  );
}

// Бейдж "перша літера" (ws-hint-letter-badge, globals.css) — спільний для
// всіх трьох форм картки (ImageTile/TextPill/LongCard), показується лише
// коли слову взяли підказку і воно ще не знайдене (hinted, рахується
// кожною карткою локально з її ж found/hintUsed-пропсів). Фіксована "…"
// (не по літері на решту слова) — щоб довжина слова НЕ розкривалась через
// кількість крапок. role="img" + aria-label (не на самому interactive-
// елементі картки, бо бейдж — суто інформаційний довідок, не керування).
function HintFirstLetterBadge({ letter }: { letter: string }) {
  const { t } = useT();
  return (
    <span
      role="img"
      aria-label={t("ws.hintFirstLetterAria", { letter: letter.toUpperCase() })}
      className="ws-hint-letter-badge inline-flex h-8 shrink-0 items-center gap-1 rounded-full border-[1.5px] pl-1 pr-2.5"
    >
      <span
        aria-hidden="true"
        className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-[#f6dc8e] to-[#e0aa3e] text-xs font-bold text-[#6b4a14]"
      >
        {letter.toUpperCase()}
      </span>
      <span aria-hidden="true" className="ws-hint-letter-badge-dots text-xs font-bold">
        …
      </span>
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
  firstLetter,
  cardRef,
}: {
  word: WordSearchPublicBlock["words"][number];
  found: boolean;
  hintUsed: boolean;
  onZoom: () => void;
  onHint: () => void;
  // firstLetter — лише для бейджа HintFirstLetterBadge (сам синій маркер
  // на клітинці сітки — hintCells, не ця плитка). cardRef — DOM-вузол
  // ЦІЄЇ картки для scrollCardIntoView (word-search.tsx, triggerHint).
  firstLetter?: string;
  cardRef?: (el: HTMLDivElement | null) => void;
}) {
  const { t } = useT();
  const hinted = hintUsed && !found;
  return (
    <div
      ref={cardRef}
      onClick={onHint}
      className={`flex flex-col overflow-hidden ${LEGEND_TILE_BASE} ${hinted ? "ws-clue-hinted" : ""} ${
        found ? "cursor-default" : "cursor-pointer"
      }`}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onZoom();
        }}
        aria-label={t("button.showFullImageAria")}
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
          <span className="absolute inset-x-0 bottom-0 truncate bg-white/85 px-1 py-0.5 text-center font-heading text-xs font-semibold dark:bg-[var(--dark-surface-fill-translucent)]">
            {word.word}
          </span>
        )}
        {/* Бейдж "перша літера" — лівий низ, подалі від лампочки (правий
            верх, нижче в цьому ж компоненті). */}
        {hinted && firstLetter && (
          <span className="absolute bottom-1.5 left-1.5">
            <HintFirstLetterBadge letter={firstLetter} />
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
          state={bulbState(found, hintUsed)}
          as="span"
          overImage
          className="absolute right-1.5 top-1.5"
        />
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
  firstLetter,
  cardRef,
}: {
  text: string;
  audioUrl?: string;
  hintStart?: { row: number; col: number } | null;
  found: boolean;
  hintUsed: boolean;
  onHint: () => void;
  firstLetter?: string;
  cardRef?: (el: HTMLDivElement | null) => void;
}) {
  const showIcon = found || !!hintStart;
  const hinted = hintUsed && !found;
  return (
    <div
      ref={cardRef}
      role="button"
      tabIndex={0}
      onClick={onHint}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onHint();
        }
      }}
      className={`${LEGEND_PILL} ${hinted ? "ws-clue-hinted ws-pill-hinted-stack" : ""} ${showIcon ? "pl-1.5 pr-3" : ""} ${found ? "cursor-default opacity-50" : "cursor-pointer"}`}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        {showIcon && <HintBulb state={bulbState(found, hintUsed)} as="span" />}
        <span className={`min-w-0 whitespace-normal break-words [overflow-wrap:anywhere] ${CLUE_TEXT} ${found ? "line-through" : ""}`}>{text}</span>
        {audioUrl && (
          <span onClick={(e) => e.stopPropagation()}>
            <CompactAudioButton src={audioUrl} />
          </span>
        )}
      </span>
      {/* Бейдж "перша літера" — ДРУГИЙ рядок пілюлі, лише в hinted-стані
          (ws-pill-hinted-stack вище перемикає пілюлю на flex-col). */}
      {hinted && firstLetter && <HintFirstLetterBadge letter={firstLetter} />}
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
  firstLetter,
  cardRef,
}: {
  word: WordSearchPublicBlock["words"][number];
  found: boolean;
  hintUsed: boolean;
  onZoom: () => void;
  onHint: () => void;
  firstLetter?: string;
  cardRef?: (el: HTMLDivElement | null) => void;
}) {
  const { t } = useT();
  const hasImage = !!word.imageUrl;
  const showBadge = found || !!word.hintStart;
  const hinted = hintUsed && !found;
  const badge = showBadge ? (
    <HintBulb
      state={bulbState(found, hintUsed)}
      as="span"
      className={hasImage ? "absolute right-2 top-2" : ""}
    />
  ) : null;
  return (
    <div
      ref={cardRef}
      role="button"
      tabIndex={0}
      onClick={onHint}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onHint();
        }
      }}
      className={`${LEGEND_LONG_CARD} ${hinted ? "ws-clue-hinted" : ""} ${hasImage ? "pr-9" : ""} ${
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
          aria-label={t("button.showFullImageAria")}
          className="relative shrink-0 cursor-zoom-in"
        >
          <ImageOrPlaceholder src={word.imageUrl} alt="" className="h-16 w-16 rounded object-cover" useFocus />
        </button>
      )}
      <div className="min-w-0 flex-1 pt-[3px]">
        <span className={`break-words [overflow-wrap:anywhere] ${CLUE_TEXT} ${found ? "line-through" : ""}`}>{frenchNbsp(word.translation || word.word)}</span>
        {word.audioUrl && (
          <div className="mt-1" onClick={(e) => e.stopPropagation()}>
            <CompactAudioButton src={word.audioUrl} />
          </div>
        )}
        {/* Бейдж "перша літера" — під текстом підказки, той самий принцип,
            що в TextPill. */}
        {hinted && firstLetter && (
          <div className="mt-1.5">
            <HintFirstLetterBadge letter={firstLetter} />
          </div>
        )}
      </div>
      {hasImage && badge}
    </div>
  );
}

// ЕТАП K2 — геометрія капсули (знайдене слово / поточне виділення) у
// px-калькуляціях через var(--cw) (той самий токен, що й сітка/зум), без
// жодного вимірювання DOM: усі величини (dist/mid/angle) — у "клітинкових"
// одиницях (1 = ширина клітинки), тож ПОЗИЦІЯ рахується нативним CSS
// calc() — реагує на zoom/контейнер автоматично, як і решта сітки.
// ЕТАП K3 — товщина (height, поперек слова) зменшена з cw+10px до cw-6px
// (інсет 3px з кожного боку клітинки) — раніше капсула виходила на 5px у
// суміжний рядок/колонку й торкалась капсули сусіднього слова там, де
// рядки впритул. Довжина (width, уздовж слова) — з cw*dist+cw+10px до
// cw*dist+cw-2px: виступає лише ~1px за зовнішній край першої/останньої
// клітинки (було 5px) — слова в тому самому рядку через одну клітинку
// тепер теж не стикаються. pointer-events:none на елементі (не лише в
// класі) — належить лише до СТИЛЮ, але дублюємо тут явно, бо це умова
// коректності виділення дотиком, не просто вигляд.
function capsuleStyle(start: Cell, end: Cell): CSSVarStyle {
  const x1 = start.col + 0.5;
  const y1 = start.row + 0.5;
  const x2 = end.col + 0.5;
  const y2 = end.row + 0.5;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const distCells = Math.sqrt(dx * dx + dy * dy);
  const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  return {
    position: "absolute",
    left: `calc(var(--cw) * ${midX})`,
    top: `calc(var(--cw) * ${midY})`,
    width: `calc(var(--cw) * ${distCells} + var(--cw) - 2px)`,
    height: `calc(var(--cw) - 6px)`,
    transform: `translate(-50%, -50%) rotate(${angleDeg}deg)`,
    pointerEvents: "none",
  } as CSSVarStyle;
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
  hintsReducePoints,
  cols,
  zoom,
  onZoomChange,
  onResult,
  blockCount,
  activeBlock,
  onChangeBlock,
}: {
  taskId: string;
  block: WordSearchPublicBlock;
  blockIndex?: number;
  active: boolean;
  isDelf?: boolean;
  hintsReducePoints: boolean;
  // ЕТАП J — спільні для ВСІХ блоків вправи (рахує/тримає WordSearchExercise):
  // cols — max(gridSize) по всіх блоках (однакова клітинка незалежно від
  // того, який блок менший), zoom — студентський масштаб 1/1.25/1.5/2.
  cols: number;
  zoom: number;
  // Пінч двома пальцями (use-pinch-zoom.ts) міняє той самий zoom-стан, що
  // й кнопки +/− у WordSearchExercise — лише ТАМ є setZoom, тож він
  // прокидається сюди окремим пропом.
  onZoomChange?: (zoom: number) => void;
  onResult: (result: WordSearchBlockResult) => void;
  // ЕТАП M — той самий глобальний activeBlock/onChangeBlock, що й
  // BlockTabs/BlockNavigation на рівні WordSearchExercise: усі блоки
  // змонтовані одночасно (кожен зі своїм pending/result, useExerciseCheck
  // вище), тож рядок check+←/→ малює САМ активний блок (BlockNavFooter тут,
  // не WordSearchExercise — hideFooter там), щоб не дублювати рядок.
  blockCount?: number;
  activeBlock?: number;
  onChangeBlock?: (index: number) => void;
}) {
  const { t } = useT();
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
  const scrollContainerId = useId();
  const scrollHint = useScrollOverflowHint(scrollRef, active);
  // Слова, для яких клікали підказку — надсилається разом із foundWords
  // (WordSearchAnswer.hintedWords), для 50%-балів при hintsReducePoints.
  const [hintedWords, setHintedWords] = useState<Set<string>>(new Set());
  // Практика "Повторити без балів" (не Corrigez vos erreurs — word_search
  // не підтримується тим механізмом, error-review.ts) — повністю локальний
  // паралельний стан: нічого з practiceFoundWords/practiceHintedWords
  // ніколи не йде на сервер (жодного submit у practiceMode), тож бали/
  // mistakes/block_progress цей режим не чіпає. Вимикається/чиститься при
  // кожному вході (кнопка "Повторити без балів" нижче), щоб починати з
  // чистого стану.
  const [practiceMode, setPracticeMode] = useState(false);
  const [practiceFoundWords, setPracticeFoundWords] = useState<Map<string, Cell[]>>(new Map());
  const [practiceHintedWords, setPracticeHintedWords] = useState<Set<string>>(new Set());

  const { submit, pending, result, error } = useExerciseCheck(taskId);
  const detail = result?.detail as WordSearchDetail | undefined;
  // locked — виділення/підказки вимкнені одразу після ПЕРШОЇ перевірки
  // (startDrag/triggerHint нижче самі перевіряють locked) — блок завжди
  // "фінальний" після check (кнопка "Перевірити ще раз" прибрана, лишається
  // лише окрема практика без балів нижче). practiceMode тимчасово знімає
  // це обмеження лише для ЛОКАЛЬНОГО practiceFoundWords/practiceHintedWords
  // стану, не для справжнього foundWords/hintedWords.
  const locked = !!result;
  const allowRecheck = blockIndex !== undefined;
  const checkConfirm = useCheckConfirm();
  // null — студент ще не торкався тоглу: тоді відкритість іде за locked
  // (розгортається САМА одразу після перевірки, без ефекту/setState —
  // просто похідне значення нижче, answersOpen). Явний true/false — студент
  // сам клацнув заголовок хоч раз, це вже остаточний стан, locked більше не
  // перебиває його (повторна "Перевірити ще раз" не повинна знову
  // розгортати тогл, який студент щойно сам згорнув).
  const [answersOpenOverride, setAnswersOpenOverride] = useState<boolean | null>(null);
  const answersOpen = answersOpenOverride ?? locked;
  const answersPanelId = useId();

  useEffect(() => {
    if (result) onResult(result as WordSearchBlockResult);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  function startDrag(cell: Cell) {
    if (locked && !practiceMode) return;
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
        const currentFound = practiceMode ? practiceFoundWords : foundWords;
        const match = block.words.find((w) => {
          if (currentFound.has(w.word)) return false;
          const sanitized = sanitizeWordForGrid(w.word).toUpperCase();
          return sanitized === letters || sanitized === reversed;
        });
        if (match) {
          if (practiceMode) setPracticeFoundWords((prev) => new Map(prev).set(match.word, path));
          else setFoundWords((prev) => new Map(prev).set(match.word, path));
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

  // ЕТАП N — авто-скрол до краю під час виділення на збільшеному зумі:
  // коли сітка ширша/вища за scrollRef (ws-scroll) і виділення йде в бік
  // клітинок, що зараз поза видимою областю, курсор/палець фізично не може
  // туди дотягнутись (touch-action:none на контейнері вимикає нативний
  // скрол саме під час жесту) — контейнер мусить прокручуватись САМ, доки
  // вказівник лишається біля краю.
  // lastPointerRef — останні відомі екранні координати вказівника, і для
  // миші (onMouseDown/onMouseEnter клітинок нижче + document "mousemove"
  // під час dragging), і для дотику (handleTouchPointerDown/Move вище) —
  // через РЕФ, не стан: курсор рухається щокадрово під час авто-скролу,
  // окремий React-стан на кожен кадр був би зайвим ререндером.
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  // moveDragRef — завжди свіжий moveDrag (пересоздається щорендеру,
  // замикає актуальні dragging/dragStart). rAF-цикл нижче монтується лише
  // ОДИН раз на весь час dragging (ефект залежить тільки від [dragging]),
  // тож пряме замикання на moveDrag у тому ефекті лишилось би застарілим
  // (stale closure) після першого ж setDragEnd — викликаємо через реф,
  // який оновлюється щорендеру, замість цього.
  const moveDragRef = useRef(moveDrag);
  useEffect(() => {
    moveDragRef.current = moveDrag;
  });

  // Миша не дає природного "pointermove, доки контейнер сам скролиться" —
  // onMouseEnter клітинки спрацьовує лише коли курсор РЕАЛЬНО рухається
  // над новою клітинкою, а не коли клітинки проїжджають під нерухомим
  // курсором через авто-скрол. document "mousemove" під час dragging —
  // той самий підхід, що вже є для дотику (handleTouchPointer*), лише для
  // миші додатково (там координати й так приходять у pointer-подіях).
  useEffect(() => {
    if (!dragging) return;
    function onMouseMove(e: MouseEvent) {
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
    }
    document.addEventListener("mousemove", onMouseMove);
    return () => document.removeEventListener("mousemove", onMouseMove);
  }, [dragging]);

  // Зона краю (px від межі ВИДИМОГО rect контейнера) і максимальна
  // швидкість (px/кадр) — підібрані під "приблизно 1 клітинка, 40-56px":
  // при --cw у типових межах (22-72px залежно від zoom) clamp тримає зону
  // не меншою за 40px (дрібна клітинка — зона все одно відчутна) і не
  // більшою за 56px (велика клітинка на сильному зумі — зона не займає
  // пів-екрана). MAX_SPEED_PX — швидкість САМЕ на межі/за межею контейнера
  // (де factor нижче природно насичується до 1); REDUCED_SPEED_PX —
  // фіксована (не прогресивна) швидкість для prefers-reduced-motion —
  // auto-scroll лишається ДОСТУПНИМ (без нього виділення за межами видимої
  // частини було б неможливим), лише без прискорення ближче до краю.
  const EDGE_ZONE_MIN_PX = 40;
  const EDGE_ZONE_MAX_PX = 56;
  const MAX_SPEED_PX = 14;
  const REDUCED_SPEED_PX = 5;

  function getCellSizePx(container: HTMLDivElement): number {
    const cell = container.querySelector<HTMLElement>("[data-row][data-col]");
    return cell ? cell.getBoundingClientRect().width : EDGE_ZONE_MIN_PX;
  }

  // Головний rAF-цикл: монтується рівно на час dragging (ефект лишається
  // активним незалежно від того, звідки саме почалось виділення — миша чи
  // дотик), сам читає lastPointerRef щокадрово (а не чекає на нову
  // pointer-подію, якої під час скролу нерухомого вказівника НЕ буде).
  useEffect(() => {
    if (!dragging) return;
    const container = scrollRef.current;
    if (!container) return;
    const reduceMotion =
      typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let rafId = 0;

    function tick() {
      const pointer = lastPointerRef.current;
      if (pointer && container) {
        const rect = container.getBoundingClientRect();
        const edgeZone = Math.min(EDGE_ZONE_MAX_PX, Math.max(EDGE_ZONE_MIN_PX, getCellSizePx(container)));
        let dx = 0;
        let dy = 0;

        function speedFor(distanceIntoEdge: number): number {
          if (reduceMotion) return REDUCED_SPEED_PX;
          const factor = Math.min(1, Math.max(0, (edgeZone - distanceIntoEdge) / edgeZone));
          return MAX_SPEED_PX * factor;
        }

        const leftDist = pointer.x - rect.left;
        const rightDist = rect.right - pointer.x;
        const topDist = pointer.y - rect.top;
        const bottomDist = rect.bottom - pointer.y;
        if (leftDist < edgeZone) dx -= speedFor(leftDist);
        else if (rightDist < edgeZone) dx += speedFor(rightDist);
        if (topDist < edgeZone) dy -= speedFor(topDist);
        else if (bottomDist < edgeZone) dy += speedFor(bottomDist);

        if (dx !== 0) {
          const maxScrollLeft = container.scrollWidth - container.clientWidth;
          container.scrollLeft = Math.min(maxScrollLeft, Math.max(0, container.scrollLeft + dx));
        }
        if (dy !== 0) {
          const maxScrollTop = container.scrollHeight - container.clientHeight;
          container.scrollTop = Math.min(maxScrollTop, Math.max(0, container.scrollTop + dy));
        }
        if (dx !== 0 || dy !== 0) {
          const cell = cellFromPoint(pointer.x, pointer.y);
          if (cell) moveDragRef.current(cell);
        }
      }
      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [dragging]);

  // ЕТАП J — прокрутка сітки ДВОМА пальцями: сітка лишається touch-action:
  // none (нативний pinch/scroll вимкнено, замість нього кнопки зуму) —
  // одно-пальцевий дотик і далі виділяє слово (startDrag/moveDrag), другий
  // палець скасовує поточне виділення (без перевірки слова). Усе
  // відстежується тут-таки (не через React-стан — часта зміна на кожен
  // pointermove, стан був би зайвим ререндером).
  // ЕТАП — pinch-to-zoom: двопалицеве панорамування вище тепер віддане
  // usePinchZoom (use-pinch-zoom.ts, спільне з crossword.tsx) — середня
  // точка пальців одночасно і зумить (відстань між пальцями), і панорамує
  // (сам рух середньої точки), той самий природний pinch, що в будь-якому
  // галерейному застосунку; це ЗАМІНЮЄ попередній "лише панорамування" на
  // 2 пальцях (ratio=1, коли відстань не змінюється, — чистий pan, як і
  // було). suppressSelectRef — як і раніше, блокує новий одно-пальцевий
  // drag, доки не піднято ВСІ пальці (+300мс після, через
  // pinch.isSuppressingClick, щоб останній палець не стартував виділення
  // одразу після жесту).
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const suppressSelectRef = useRef(false);

  const isMobile640 = useIsMobilePinchViewport();
  const pinch = usePinchZoom(scrollRef, zoom, onZoomChange ?? (() => {}), {
    enabled: isMobile640 && active,
    onPinchStart: () => {
      setDragging(false);
      setDragStart(null);
      setDragEnd(null);
      suppressSelectRef.current = true;
    },
  });

  function handleTouchPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "touch") return;
    const pointers = activePointersRef.current;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    e.currentTarget.setPointerCapture(e.pointerId);
    pinch.feedDown(e);
    if (pointers.size === 1) {
      if (suppressSelectRef.current || pinch.isSuppressingClick()) return;
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
      const cell = cellFromPoint(e.clientX, e.clientY);
      if (cell) startDrag(cell);
    }
  }

  function handleTouchPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "touch") return;
    const pointers = activePointersRef.current;
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.feedMove(e)) return;
    if (pointers.size === 1 && dragging) {
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
      const cell = cellFromPoint(e.clientX, e.clientY);
      if (cell) moveDrag(cell);
    }
  }

  function handleTouchPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "touch") return;
    const pointers = activePointersRef.current;
    pointers.delete(e.pointerId);
    pinch.feedUp(e);
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
    if (!container) return;
    const pinchFocal = pinch.getFocal();
    if (pinchFocal) {
      applyPinchFocal(container, pinchFocal, zoom, pinchFocal.midX, pinchFocal.midY);
      pinch.clearFocal();
      return;
    }
    const prevMetrics = prevMetricsRef.current;
    if (!prevMetrics) return;
    keepViewAfterZoom(container, prevMetrics, prevZoom, zoom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom]);

  const gridSize = block.grid.length;
  const previewPath = dragging && dragStart && dragEnd ? buildPath(dragStart, dragEnd) : [];
  const previewKeys = new Set(previewPath.map(cellKey));

  // Знайдені слова більше не зафарбовують клітинки тут — їх показує SVG-
  // капсула (оверлей нижче), піднята НАД сіткою.
  function cellClass(cell: Cell) {
    const key = cellKey(cell);
    if (previewKeys.has(key)) return "bg-blue-200 dark:bg-blue-800 ws-cell-previewing ws-letter-selecting";
    return "";
  }

  function isFound(word: string): boolean {
    if (practiceMode) return practiceFoundWords.has(word);
    if (detail) return detail.words.find((d) => d.word === word)?.found ?? false;
    return foundWords.has(word);
  }

  function wordHintUsed(word: string): boolean {
    if (practiceMode) return practiceHintedWords.has(word);
    // ФІКС — під час гри (до перевірки блоку) detail ще немає взагалі:
    // раніше функція тут одразу падала на ?? false, тож лампочка/картка
    // ЦІЛУ гру лишались у стані "доступно", хоч підказку й узято (hintedWords
    // уже містить слово, і сама сітка підсвічується коректно — hintCells
    // рахується НАПРЯМУ з hintedWords, не через цю функцію). Той самий
    // порядок гілок, що isFound() вище: practiceMode → серверний detail
    // (після Перевірити) → локальний hintedWords (під час гри).
    if (detail) return detail.words.find((d) => d.word === word)?.hintUsed ?? false;
    return hintedWords.has(word);
  }

  // Похідний набір клітинок для синього маркера підказки (hintHighlightCells,
  // word-search-hint-highlight.ts) — не окремий стан: перераховується щоразу
  // з hintedWords і актуального "знайдено" (детальніше — коментар у файлі
  // функції). foundWordsSet — ті самі слова, що isFound() визнає знайденими
  // (детальний результат сервера, якщо вже перевірено, інакше клієнтський
  // foundWords), просто у вигляді Set<string> для чистої функції.
  const effectiveFoundWords = practiceMode ? practiceFoundWords : foundWords;
  const effectiveHintedWords = practiceMode ? practiceHintedWords : hintedWords;
  const foundWordsSet = new Set(block.words.filter((w) => isFound(w.word)).map((w) => w.word));
  const hintCells = hintHighlightCells(block.words, effectiveHintedWords, foundWordsSet);

  // ЕТАП K — клітинки знайдених слів (для ws-letter-found, лише світлого
  // кольору/ваги літери) — похідне з effectiveFoundWords (справжній
  // foundWords чи, у practiceMode, окремий practiceFoundWords), те саме,
  // що SVG-капсули/лінії нижче, не окремий стан.
  const foundLetterKeys = new Set(
    [...effectiveFoundWords.values()].flatMap((cells) => cells.map(cellKey))
  );

  // Клітинки лише ПРОПУЩЕНИХ слів блоку — заповнюється після перевірки
  // (detail.words[].cells, grade.ts: той самий target, з яким сервер
  // звіряє відповідь): клієнт сам не знає розміщення пропущених слів (їх
  // ніхто не виділяв), тож без цього поля зелену підсвітку пропущеного
  // слова намалювати нічим. Знайдені слова й далі лавандові (foundWords/
  // foundLetterKeys нижче) — зелена підсвітка лише для w.found === false.
  // practiceMode — ніколи не показуємо (практика не звіряється з сервером,
  // тож "пропущено" тут не має сенсу).
  const missedCellsByWord = new Map<string, Cell[]>();
  if (detail && !practiceMode) {
    for (const w of detail.words) {
      if (!w.found && w.cells.length > 0) missedCellsByWord.set(w.word, w.cells);
    }
  }
  const missedLetterKeys = new Set(
    [...missedCellsByWord.values()].flatMap((cells) => cells.map(cellKey))
  );

  // hintStart — координата ПЕРШОЇ літери слова, порахована на сервері один
  // раз при санітизації (sanitize.ts), не весь шлях розміщення: усі літери
  // сітки й так видимі студенту, тож розкриття лише СТАРТОВОЇ клітинки —
  // менший компроміс, ніж уже наявне повне розкриття в crossword/letter_gaps.
  // Картки з золотим "дихаючим" ореолом (ws-clue-hinted) — DOM-вузли за
  // словом, лише для scrollCardIntoView нижче (жодного стилю/стану тут не
  // тримаємо — Map, не useState, оновлюється на кожен рендер картки).
  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());
  function registerCardRef(word: string, el: HTMLElement | null) {
    if (el) cardRefs.current.set(word, el);
    else cardRefs.current.delete(word);
  }

  // Перша літера слова (для HintFirstLetterBadge) — та сама клітинка, що
  // hintStart, прочитана із самої сітки блоку: координату вже рахує сервер
  // (sanitize.ts), тут лише беремо букву з block.grid за нею.
  function firstLetterOf(w: WordSearchPublicBlock["words"][number]): string | undefined {
    if (!w.hintStart) return undefined;
    return block.grid[w.hintStart.row]?.[w.hintStart.col];
  }

  // п.5 задачі — картка щойно підказаного слова м'яко прокручується у
  // видиму область (block:"nearest" сам не рухає, якщо картка вже видима,
  // і рухає МІНІМАЛЬНО, якщо ні — тож сітка лишається на місці, доки обидві
  // (сітка+картка) влазять в екран одночасно). rAF — чекаємо рендер нового
  // ws-clue-hinted класу (і, відповідно, появу бейджа), перш ніж міряти.
  function scrollCardIntoView(word: string) {
    requestAnimationFrame(() => {
      const el = cardRefs.current.get(word);
      if (!el) return;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
    });
  }

  function triggerHint(w: WordSearchPublicBlock["words"][number]) {
    // Повторний тап по вже підказаному (і ще не знайденому) слову — нічого
    // не робить: без повторного списання балів (hintedWords — Set, і так
    // ідемпотентний) і без зайвого ререндеру підсвічування. practiceMode —
    // підказки безкоштовні й локальні (practiceHintedWords), locked не
    // застосовується.
    if (practiceMode) {
      if (isDelf || isFound(w.word) || !w.hintStart || practiceHintedWords.has(w.word)) return;
      setPracticeHintedWords((prev) => new Set(prev).add(w.word));
      scrollCardIntoView(w.word);
      return;
    }
    if (locked || isDelf || isFound(w.word) || !w.hintStart || hintedWords.has(w.word)) return;
    setHintedWords((prev) => new Set(prev).add(w.word));
    scrollCardIntoView(w.word);
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
      {practiceMode && (
        <div role="status" className="hint-points-notice">
          <HintBulb state="available" as="span" />
          <span>{t("crossword.practiceModeNote")}</span>
        </div>
      )}
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
            id={scrollContainerId}
            className="ws-scroll w-full select-none overflow-x-auto"
            // ЕТАП — GridScrollSlider бере на себе горизонтальне
            // прокручування на мобільному (grid-scroll-slider.tsx):
            // pan-y лишає вертикальний скрол сторінки одним пальцем,
            // горизонтальне панорамування прибране (раніше — повне
            // touch-action:none, тут замінене на pan-y лише ≤640px,
            // десктоп/планшет і далі touch-action:none, як було —
            // там керує миша/трекпад, а не палець). Одно-пальцеве
            // виділення слова (startDrag/moveDrag) і авто-скрол під час
            // виділення (scrollLeft програмно) не залежать від touch-
            // action — вони самі ставлять scrollLeft, не чекають на
            // нативне панорамування.
            style={{ touchAction: isMobile640 ? "pan-y" : "none" }}
            onPointerDown={handleTouchPointerDown}
            onPointerMove={handleTouchPointerMove}
            onPointerUp={handleTouchPointerUp}
            onPointerCancel={handleTouchPointerUp}
          >
            <div
              className="grid-zoom-inner ws-sheet w-max mx-auto"
              style={{ "--cols": cols, "--zoom": zoom } as CSSVarStyle}
            >
              {/* border-l/border-t на контейнері + border-r/border-b на кожній
                  клітинці — той самий візуальний ефект, що border-collapse на
                  <table> (суцільні 1px лінії, без подвоєння на межах між
                  клітинками); у світлій темі (ws-grid/ws-cell, globals.css)
                  ці рамки стають прозорими — "плаваючий лист" без внутрішніх
                  ліній (ЕТАП K). */}
              <div className="relative">
                <div
                  className="ws-grid grid border-l border-t border-neutral-200 font-heading font-semibold dark:border-neutral-700"
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
                      const key = cellKey({ row: ri, col: ci });
                      const isHinted = hintCells.has(key);
                      // Лавандова "знайдено" лишається й після locked (не
                      // лише під час гри) — зелена "пропущено" (missedLetterKeys)
                      // домальовується ТІЛЬКИ для клітинок пропущених слів,
                      // не чіпаючи вже лавандові. Якщо клітинка належить і
                      // знайденому, і пропущеному слову (перетин) — лаванда
                      // пріоритетніша для кольору літери (без змішування).
                      const isFoundLetter = foundLetterKeys.has(key);
                      const isCorrectLetter = locked && !isFoundLetter && missedLetterKeys.has(key);
                      // ЕТАП O — та сама причина, що crossword.tsx: підлога 0.75rem
                      // (12px) рахувалась проти ВЖЕ помноженого на --zoom var(--cw), тож
                      // на кроці зуму 0.65 (а на мобільному .ws-sheet, де підлога clamp
                      // сама нижча — 22px замість 28px, — ще легше) cw*0.5 опускається
                      // нижче 12px і підлога "вмикається": літера більше не стискається
                      // пропорційно зі сіткою. Клітинка тут і так flex items-center
                      // justify-center (на відміну від <input> у crossword.tsx, де сам
                      // браузер центрує рядок тексту) — видимого зсуву це не дає, але
                      // літера все одно стає відносно завеликою для клітинки. Нова
                      // підлога (0.4rem/6.4px) — безпечний заглушний мінімум під
                      // найгірший випадок цього файлу (мобільна підлога cw 22px × zoom
                      // 0.65 ≈ 14.3px, природний розмір ≈7.15px) — підлога тут теж
                      // ніколи реально не спрацьовує.
                      return (
                        <div
                          key={`${ri}:${ci}`}
                          data-row={ri}
                          data-col={ci}
                          onMouseDown={(e) => {
                            lastPointerRef.current = { x: e.clientX, y: e.clientY };
                            startDrag({ row: ri, col: ci });
                          }}
                          onMouseEnter={(e) => {
                            lastPointerRef.current = { x: e.clientX, y: e.clientY };
                            moveDrag({ row: ri, col: ci });
                          }}
                          className={`ws-cell flex aspect-square cursor-pointer items-center justify-center border-b border-r border-neutral-200 text-center dark:border-neutral-700 ${cellClass({ row: ri, col: ci })} ${
                            isHinted
                              ? "ws-cell-hinted bg-blue-100 font-bold text-blue-700 ring-2 ring-inset ring-blue-500 dark:bg-blue-900/50 dark:text-blue-200"
                              : ""
                          } ${isCorrectLetter ? "ws-letter-correct" : isFoundLetter ? "ws-letter-found" : ""}`}
                          style={{ fontSize: "max(0.4rem, calc(var(--cw) * 0.5))", lineHeight: 1 }}
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
                    пропорційно будь-якому --cw/zoom, без перерахунку тут.
                    ЕТАП K — лише темна тема бачить цей шар (ws-lines-layer,
                    globals.css); світла бачить капсули (.ws-capsule-layer)
                    нижче замість нього. */}
                <svg
                  viewBox={`0 0 ${gridSize} ${gridSize}`}
                  className="ws-lines-layer pointer-events-none absolute inset-0 h-full w-full"
                >
                  {[...effectiveFoundWords.entries()].map(([word, cells]) => {
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
                {/* ЕТАП K ("плаваючий лист", СВІТЛА тема лише) — капсули
                    знайдених слів (лавандова заливка) і поточного виділення
                    (пунктирна індигова), position:absolute/transform-rotate,
                    геометрія — capsuleStyle() вище. pointer-events:none і в
                    className, і в самому style — не перехоплює ні мишу, ні
                    дотик (вимога п.5 задачі): виділення й далі керується
                    виключно обробниками на клітинках нижче. Пізніші слова
                    малюються пізніше в DOM — природно лягають ПОВЕРХ раніших
                    при перетині (вимога п.4). */}
                <div className="ws-capsule-layer pointer-events-none absolute inset-0">
                  {[...effectiveFoundWords.entries()].map(([word, cells]) => {
                    if (cells.length === 0) return null;
                    return (
                      <div
                        key={word}
                        className="ws-capsule ws-capsule-found"
                        style={capsuleStyle(cells[0], cells[cells.length - 1])}
                      />
                    );
                  })}
                  {locked &&
                    [...missedCellsByWord.entries()].map(([word, cells]) => {
                      if (cells.length === 0) return null;
                      return (
                        <div
                          key={word}
                          className="ws-capsule ws-capsule-correct"
                          style={capsuleStyle(cells[0], cells[cells.length - 1])}
                        />
                      );
                    })}
                  {dragging && previewPath.length > 1 && (
                    <div
                      className="ws-capsule ws-capsule-selecting"
                      style={capsuleStyle(previewPath[0], previewPath[previewPath.length - 1])}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
          <GridScrollSlider scrollRef={scrollRef} controlsId={scrollContainerId} zoom={zoom} />
        </div>

        {scrollHint && (
          <p className={HINT_TEXT}>
            <span className="scroll-hint-fine scroll-hint-desktop">{t("ws.gridWiderHint")}</span>
            <span className="scroll-hint-coarse scroll-hint-desktop">{t("ws.gridWiderHintTouch")}</span>
            <span className="scroll-hint-mobile">{t("ws.gridWiderHintMobile")}</span>
          </p>
        )}

        {/* ЕТАП K/L — легенда кольорів під сіткою, тепер в ОБОХ темах
            (globals.css .ws-legend завжди flex); кольори крапок "Знайдено"/
            "Виділяю" — через CSS-змінні --ws-legend-dot-* (теми різні
            значення), "Підказка" — той самий золотий #e0aa3e в обох темах,
            лишається inline (не потребує var). */}
        <div className="ws-legend">
          <span className="ws-legend-item">
            <span className="ws-legend-dot ws-legend-dot-found" />
            {t("ws.legendFound")}
          </span>
          <span className="ws-legend-item">
            <span className="ws-legend-dot ws-legend-dot-selecting" />
            {t("ws.legendSelecting")}
          </span>
          <span className="ws-legend-item">
            <span className="ws-legend-dot" style={{ background: "#e0aa3e" }} />
            {t("ws.legendHint")}
          </span>
          {locked && !practiceMode && (
            <span className="ws-legend-item">
              <span className="ws-legend-dot ws-legend-dot-correct" />
              {t("ws.legendNotFound")}
            </span>
          )}
        </div>

        {/* Легенда — на всю ширину (той самий принцип, що crossword.tsx:
            ширину секцій підказок НЕ прив'язано до пікселів сітки), не
            flex-wrap по центру. Заголовок+лічильник+прогрес-смужка над
            плитками, картинки й текстові підказки — два окремі grid-и
            рівних колонок (різна щільність: картинки дрібніші за плитку,
            тож більше колонок влазить). */}
        <div className="w-full">
          <div className="flex items-baseline justify-between">
            <span className="font-heading text-sm text-[var(--text-muted-caption)] dark:text-[var(--text-muted-caption)]">{t("ws.findWords")}</span>
            <span
              className={`font-heading text-sm font-semibold tabular-nums ${
                allFound ? "text-green-600 dark:text-green-400" : ""
              }`}
            >
              {t("ws.foundOfTotal", { found: foundCount, total: totalWords })}
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
                        firstLetter={firstLetterOf(w)}
                        cardRef={(el) => registerCardRef(w.word, el)}
                      />
                    ))}
                  </div>
                )}
                {textWords.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {textWordsSorted.map((w) => (
                      <TextPill
                        key={w.word}
                        text={frenchNbsp(w.translation || w.word)}
                        audioUrl={w.audioUrl}
                        hintStart={w.hintStart}
                        found={isFound(w.word)}
                        hintUsed={wordHintUsed(w.word)}
                        onHint={() => triggerHint(w)}
                        firstLetter={firstLetterOf(w)}
                        cardRef={(el) => registerCardRef(w.word, el)}
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
                        firstLetter={firstLetterOf(w)}
                        cardRef={(el) => registerCardRef(w.word, el)}
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
                        firstLetter={firstLetterOf(w)}
                        cardRef={(el) => registerCardRef(w.word, el)}
                      />
                    ))}
                  </div>
                )}
                {textCompactWords.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {textCompactWordsSorted.map((w) => (
                      <TextPill
                        key={w.word}
                        text={frenchNbsp(w.translation || w.word)}
                        audioUrl={w.audioUrl}
                        hintStart={w.hintStart}
                        found={isFound(w.word)}
                        hintUsed={wordHintUsed(w.word)}
                        onHint={() => triggerHint(w)}
                        firstLetter={firstLetterOf(w)}
                        cardRef={(el) => registerCardRef(w.word, el)}
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
          <div className="flex flex-col gap-2">
            {result && !practiceMode && (
              <TaskResult correct={result.correct} pointsEarned={result.pointsEarned} pointsPossible={result.pointsPossible} hintSummary={{ hintCount: detail?.words.filter((w) => w.hintUsed).length ?? 0, reducesPoints: hintsReducePoints }} />
            )}
            {blockCount !== undefined && activeBlock !== undefined && onChangeBlock && (
              <BlockNavFooter
                blockCount={blockCount}
                activeBlock={activeBlock}
                onChangeBlock={onChangeBlock}
                checkButton={
                  !result ? (
                    <button
                      type="button"
                      onClick={() => checkConfirm.attemptCheck(totalWords - foundCount, handleSubmit)}
                      disabled={pending}
                      className="exercise-block-check-btn btn-check"
                    >
                      {pending ? t("button.checking") : t("button.checkBlock")}
                    </button>
                  ) : null
                }
              />
            )}
            {!result && checkConfirm.confirming && (
              <CheckConfirmBar
                unansweredCount={totalWords - foundCount}
                onConfirm={() => checkConfirm.confirmCheck(handleSubmit)}
                onCancel={checkConfirm.cancelCheck}
              />
            )}
          </div>
        ) : !result ? (
          <div className="flex flex-col items-start gap-2">
            <button
              type="button"
              onClick={() => checkConfirm.attemptCheck(totalWords - foundCount, handleSubmit)}
              disabled={pending}
              className={`self-start ${BUTTON_CHECK}`}
            >
              {pending ? t("button.checking") : t("button.check")}
            </button>
            {checkConfirm.confirming && (
              <CheckConfirmBar
                unansweredCount={totalWords - foundCount}
                onConfirm={() => checkConfirm.confirmCheck(handleSubmit)}
                onCancel={checkConfirm.cancelCheck}
              />
            )}
          </div>
        ) : (
          !practiceMode && (
            <TaskResult correct={result.correct} pointsEarned={result.pointsEarned} pointsPossible={result.pointsPossible} hintSummary={{ hintCount: detail?.words.filter((w) => w.hintUsed).length ?? 0, reducesPoints: hintsReducePoints }} />
          )
        )}
        {/* Практика "Повторити без балів" — лише коли блок уже фінальний
            (result) і Corrigez vos erreurs цей тип не підтримує
            (ERROR_REVIEW_EXCLUDED_TASK_TYPES, error-review.ts). Вхід чистить
            practiceFoundWords/practiceHintedWords — щоразу новий чистий
            стан. */}
        {result && !practiceMode && (
          <button
            type="button"
            onClick={() => {
              setPracticeFoundWords(new Map());
              setPracticeHintedWords(new Set());
              setPracticeMode(true);
            }}
            className="check-confirm-btn check-confirm-btn--secondary self-start"
          >
            {t("button.practiceReset")}
          </button>
        )}
        {result && practiceMode && (
          <div className="flex flex-col items-start gap-2">
            <span className="font-heading text-sm font-semibold tabular-nums">
              {t("ws.foundOfTotalWords", { n: practiceFoundWords.size, total: totalWords })}
            </span>
            <button
              type="button"
              onClick={() => setPracticeMode(false)}
              className="check-confirm-btn check-confirm-btn--secondary self-start"
            >
              {t("button.finishPractice")}
            </button>
          </div>
        )}
        {/* Тогл "Правильні відповіді" — та сама картка/заголовок/шеврон, що
            task-result.tsx (TaskResult), але НЕ через сам TaskResult: його
            showToggle = !!children && !correct сховав би тогл саме тоді,
            коли блок пройдено повністю правильно (correct), а тут він має
            лишатись (і бути розгорнутим — answersOpen вище) незалежно від
            correct, бо зелена підсвітка в сітці видима завжди при locked.
            practiceMode — тогл ховається (справжній результат тимчасово не
            показується, доки студент не натисне "Завершити практику"). */}
        {result && !practiceMode && (
          <div className="task-result-card">
            <button
              type="button"
              aria-expanded={answersOpen}
              aria-controls={answersPanelId}
              onClick={() => setAnswersOpenOverride(!answersOpen)}
              className="task-result-toggle-header"
            >
              <span className="task-result-toggle-title">
                <span className="task-result-toggle-title-main">{t("panel.correctAnswers")}</span>
                <span className="task-result-toggle-title-sub">{t("panel.correctAnswersSub", { n: totalWords })}</span>
              </span>
              <span className="task-result-toggle-action">
                {answersOpen ? t("button.hide") : t("button.show")}
                <ChevronIcon open={answersOpen} />
              </span>
            </button>
            {answersOpen && (
              <div id={answersPanelId} className="task-result-toggle-panel flex flex-col gap-2">
                <p className="text-xs text-neutral-500 dark:text-[var(--text-muted-caption)]">{t("ws.notFoundNote")}</p>
                <div className="task-result-gap-grid task-result-gap-grid--two-col">
                  {block.words.map((w) => (
                    <div key={w.word} className="task-result-gap-row">
                      {isFound(w.word) && <WsAnswerCheck />}
                      <span className="task-result-gap-text">{w.word}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
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
  plaqueText,
  onResult,
  hidePoints,
  isDelf,
}: {
  taskId: string;
  config: WordSearchPublic;
  plaqueText?: string;
  pointsVisible: boolean;
  onResult?: (result: GradeResult) => void;
  hidePoints?: boolean;
  // Задача належить DELF-тесту — клік по легенді більше не підсвічує
  // першу літеру (triggerHint у WordSearchBlockView).
  isDelf?: boolean;
}) {
  const { lang } = useT();
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
  const { zoom, setZoom, maxZoom } = useGridZoom();

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

  // Задача "Hint legend: keep the hint bubble always visible above the
  // task" — гасіння після перевірки (allBlocksChecked/singleResult)
  // прибрано, той самий принцип, що в інших типах із цією бульбашкою:
  // воно давало порожню invisible-дірку в TaskPanelHeader на мобільному.
  // isDelf лишається — сталий на весь mount.
  const hintExplanationHidden = !!isDelf;
  const hintText = hintExplanationHidden ? null : hintExplanationText("word_search", lang);

  // Єдина пілюля балів (задача "єдина пілюля балів усюди"): до перевірки —
  // загальний бал вправи; після перевірки активного блоку/вправи — earned
  // sur possible ЦЬОГО блоку (ті самі дані, що показує TaskResult під
  // блоком) + статус-чіп.
  const activeBlockOrSingleResult = useBlocks ? blockResults[activeBlock] : singleResult;
  const headerPoints = hidePoints
    ? undefined
    : headerPointsState(
        activeBlockOrSingleResult?.pointsPossible ?? config.points,
        activeBlockOrSingleResult?.pointsEarned,
        lang
      );

  return (
    <div className={EXERCISE_STACK}>
      <BlockTabs
        plaqueText={plaqueText}
        blockCount={blockCount}
        activeBlock={activeBlock}
        onChangeBlock={setActiveBlock}
        isBlockChecked={(i) => i in blockResults}
        labels={blocks.map((b) => b.title)}
        pointsText={headerPoints?.pointsText}
      />
      <TaskPanelHeader
        blockCount={blockCount}
        activeBlock={activeBlock}
        onChangeBlock={setActiveBlock}
        isBlockChecked={(i) => i in blockResults}
        labels={blocks.map((b) => b.title)}
        {...(headerPoints ?? {})}
        instructionText={config.instructions ?? DEFAULT_INSTRUCTIONS.word_search.instruction}
        subInstructionText={taskTranslationLine({ uk: config.subInstructions, en: config.subInstructionsEn }, lang, {
          uk: DEFAULT_INSTRUCTIONS.word_search.subInstruction,
          en: DEFAULT_TRANSLATION_EN.word_search,
        })}
        hintText={hintText}
        rightContent={<GridZoomControls zoom={zoom} onChange={setZoom} maxZoom={maxZoom} />}
      />

      {!useBlocks ? (
        <WordSearchBlockView
          taskId={taskId}
          block={blocks[0]}
          active
          isDelf={isDelf}
          hintsReducePoints={config.hintsReducePoints}
          cols={cols}
          zoom={zoom}
          onZoomChange={setZoom}
          onResult={setSingleResult}
        />
      ) : (
        <BlockNavigation
          blockCount={blockCount}
          activeBlock={activeBlock}
          onChangeBlock={setActiveBlock}
          blockResults={blockResults}
          hideFooter
        >
          {/* Усі блоки змонтовані одразу — неактивні лише приховані класом
              "hidden" (display:none), НЕ умовним рендером: кожен
              WordSearchBlockView тримає власний стан (foundWords/
              hintedWords/drag/pending-результат), його не можна втратити
              при перемиканні вкладок. active — лише цьому, видимому зараз
              блоку дозволено вимірювати переповнення сітки
              (useScrollOverflowHint) — немонтований display:none контейнер
              дав би хибний (нульовий) вимір. ЕТАП M — hideFooter: рядок
              check+←/→ малює сам активний WordSearchBlockView
              (blockCount/activeBlock/onChangeBlock нижче — той самий
              onChangeBlock=setActiveBlock, що й тут). */}
          {blocks.map((b, i) => (
            <div key={i} className={i === activeBlock ? "" : "hidden"}>
              <WordSearchBlockView
                taskId={taskId}
                block={b}
                blockIndex={i}
                active={i === activeBlock}
                isDelf={isDelf}
                hintsReducePoints={config.hintsReducePoints}
                cols={cols}
                zoom={zoom}
                onZoomChange={setZoom}
                onResult={(r) => setBlockResults((prev) => ({ ...prev, [i]: r }))}
                blockCount={blockCount}
                activeBlock={activeBlock}
                onChangeBlock={setActiveBlock}
              />
            </div>
          ))}
        </BlockNavigation>
      )}
    </div>
  );
}
