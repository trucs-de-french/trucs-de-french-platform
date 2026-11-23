// Оцінка кількості рядків картки-слова letter_gaps/letter_rearrangement —
// ЧИСТА функція від даних слова (жодного DOM-вимірювання, жодного
// useEffect/ResizeObserver): детермінована (той самий вхід → той самий
// вихід), однакова на сервері й клієнті, незмінна до/після перевірки, при
// перемиканні блоку й після перезавантаження з тими самими даними —
// замінює колишнє useTwoColumnWordOrder (виміряна висота вмісту в
// браузері), видалене разом із порогами SINGLE_WORD_SPAN_THRESHOLD/
// PHRASE_SPAN_THRESHOLD (word-list-layout.ts), що оцінювали лише "чи треба
// картці повний рядок", а не реальну кількість рядків клітинок.
import { FIXED_CELL_PX, FIXED_CELL_GAP_PX } from "@/components/exercises/use-working-tile-layout";
import { splitPhraseUnits } from "./word-list-layout";
import { groupChars } from "./letter-cell-groups";
import { splitIntoSyllableChunks, reconstructUnitWord, sliceUnitByChunks } from "./syllable-split";

// Референсна внутрішня ширина рядка картки — half-width картка на
// НАЙВУЖЧОМУ 2-колонковому вікні (768px, TWO_COLUMN_BREAKPOINT_PX):
// наближення (та сама величина для ОБОХ вправ — один названий константний
// орієнтир, не реальний замір конкретного екрана), використовується як
// ФОЛБЕК, коли реальна ширина контейнера ще не вимірена (SSR/перший рендер
// — задача "simplification of the card layout", п.5: use-working-tile-
// layout.ts надає РЕАЛЬНУ виміряну half-колонкову ширину (ResizeObserver)
// для практики "Робота над помилками" — викликачі (letter-gaps.tsx/
// letter-rearrangement.tsx) підставляють її, щойно вона готова, і лише до
// того моменту (чи для РЕАЛЬНОЇ вправи сцени, що завжди лишається на цьому
// фолбеку — її вигляд і далі НЕ залежить від вимірювання) використовують
// цю константу.
export const REFERENCE_ROW_WIDTH_PX = 330;

// Приблизна ширина однієї видимої літери (letter-tile-font, 18px) —
// вузький текст, не повна 32px клітинка-пропуск.
const GIVEN_LETTER_WIDTH_PX = 11;

// "Проміжок між словами" (.word-unit-group margin-right, globals.css) —
// та сама величина для горизонтального розведення одиниць переносу,
// що й вертикального "row gap" між рядками.
const WORD_GAP_PX = 8;

// Ширина однієї групи символів (groupChars) за фіксованими константами
// клітинки: пропуск — повна клітинка (FIXED_CELL_PX), фрагмент видимих
// літер — вузький текст (кількість літер × GIVEN_LETTER_WIDTH_PX); між
// групами — той самий проміжок, що між клітинками (FIXED_CELL_GAP_PX).
function cellsWidth(chars: (string | null)[]): number {
  const groups = groupChars(chars);
  let width = 0;
  groups.forEach((g, i) => {
    width += g.type === "gap" ? FIXED_CELL_PX : g.text.length * GIVEN_LETTER_WIDTH_PX;
    if (i > 0) width += FIXED_CELL_GAP_PX;
  });
  return width;
}

// Пакує атомарні елементи (ширини в px) у рядки шириною rowWidth — та сама
// жадібна логіка, що звичайний текстовий перенос рядка (inline-block без
// примусового розриву всередині елемента): елемент влазить у поточний
// рядок, доки влазить разом із gapPx перед ним; інакше рядок закривається
// і елемент починає новий. Повертає КІЛЬКІСТЬ ЕЛЕМЕНТІВ на КОЖНОМУ рядку
// (не лише кількість рядків) — потрібно для "останній рядок не має
// лишатись одним елементом" (packBalancedRowCounts нижче). Порожній вхід
// усе одно займає рівно один (порожній) рядок — не нуль.
function packIntoRowsCounts(itemWidths: number[], rowWidth: number, gapPx: number): number[] {
  if (itemWidths.length === 0) return [1];
  const counts: number[] = [0];
  let used = 0;
  for (const w of itemWidths) {
    const needed = used === 0 ? w : used + gapPx + w;
    if (used === 0 || needed <= rowWidth) {
      used = needed;
      counts[counts.length - 1] += 1;
    } else {
      counts.push(1);
      used = w;
    }
  }
  return counts;
}

// Задача "simplification of the card layout for letter practice" (п.2) —
// "fill lines greedily, and if the last line would hold exactly 1 tile,
// move one tile from the previous line down so the last line has 2":
// точний, буквальний алгоритм із задачі, застосований ПОВЕРХ звичайного
// жадібного пакування (packIntoRowsCounts вище, незмінне). Фікс торкається
// ЛИШЕ останніх двох рядків — решта (0..length-3) лишається ТОЧНО тим
// самим жадібним розподілом, що й природний CSS-перенос браузера (звідси
// forcedBreakIndexFor нижче: потрібен РІВНО ОДИН форсований розрив, не
// один на кожну межу рядка — усі межі ОКРІМ останньої лишаються
// незмінними природним потоком).
// Захист: фікс застосовується лише коли передостанній рядок має ≥2
// елементи (інакше "позичання" лишило б ЙОГО самого один елемент — той
// самий баг, що намагаємось усунути, просто одним рядком раніше; у
// реалістичних межах rowWidth ≥ REFERENCE_ROW_WIDTH_PX це практично
// завжди ≥9 елементів на рядок, цей випадок лише теоретичний).
export function packBalancedRowCounts(itemWidths: number[], rowWidthPx: number, gapPx: number): number[] {
  const counts = packIntoRowsCounts(itemWidths, rowWidthPx, gapPx);
  const last = counts.length - 1;
  if (last >= 1 && counts[last] === 1 && counts[last - 1] >= 2) {
    counts[last] = 2;
    counts[last - 1] -= 1;
  }
  return counts;
}

// Позиція (0-based індекс елемента, "вставити розрив ПІСЛЯ нього") єдиного
// форсованого розриву, що потрібен для переходу від природного жадібного
// розподілу до збалансованого (packBalancedRowCounts вище) — null, коли
// фікс не застосовується (вміст і так влазить в один рядок, або природний
// останній рядок уже мав ≥2 елементи): природний перенос браузера вже
// точно відповідає нашій оцінці в ЦИХ випадках, жодного розриву вставляти
// не потрібно. Коли фікс ПОТРІБЕН — рівно ОДИН розрив; усі межі рядків
// ОКРІМ останньої лишаються незмінними від природного потоку (фікс лише
// перевизначає межу між двома ОСТАННІМИ рядками), тож досить одного
// елемента-розриву в точці n-3 (n - фіксована довжина останнього рядка(2) -
// 1) — виведено й перевірено для n=10 (розрив після індексу 7 → 8+2) і
// n=19 (розрив після індексу 16 → 9,8+2) у estimate-card-rows.test.ts.
export function forcedBreakIndexFor(itemWidths: number[], rowWidthPx: number, gapPx: number): number | null {
  const natural = packIntoRowsCounts(itemWidths, rowWidthPx, gapPx);
  const last = natural.length - 1;
  if (last < 1 || natural[last] !== 1 || natural[last - 1] < 2) return null;
  return itemWidths.length - 3;
}

// letter_gaps: одиниці переносу (артикль/"se"/слово) — атомарні, пакуються
// зліва праворуч у звичайному текстовому потоці (packIntoRowsCounts,
// WORD_GAP_PX між одиницями). Одиниця, що сама ширша за рядок, НЕ ділить
// рядок із сусідами (спрощення для оцінки — реальний CSS-рендер теж
// переносить таку одиницю на свій рядок цілком, перш ніж вона почне
// розбиватись на фрагменти): закриває поточний рядок, займає
// packIntoRowsCounts(фрагменти, rowWidth, 0) власних рядків (фрагменти того
// самого слова — без проміжку між собою, splitIntoSyllableChunks вище,
// .syllable-chunk у globals.css), наступна одиниця починає новий рядок.
function estimateLetterGapsCardLayoutRows(chars: (string | null)[], hiddenLetters: string[], rowWidthPx: number): number {
  const units = splitPhraseUnits(chars);
  let rows = 0;
  let rowUsedWidth = 0;
  let gapOffset = 0;
  for (const unit of units) {
    const unitWidth = cellsWidth(unit);
    if (unitWidth <= rowWidthPx) {
      if (rowUsedWidth === 0) {
        rows++;
        rowUsedWidth = unitWidth;
      } else if (rowUsedWidth + WORD_GAP_PX + unitWidth <= rowWidthPx) {
        rowUsedWidth += WORD_GAP_PX + unitWidth;
      } else {
        rows++;
        rowUsedWidth = unitWidth;
      }
    } else {
      const word = reconstructUnitWord(unit, hiddenLetters, gapOffset);
      const chunkWidths = sliceUnitByChunks(unit, splitIntoSyllableChunks(word)).map(cellsWidth);
      rows += packIntoRowsCounts(chunkWidths, rowWidthPx, 0).length;
      rowUsedWidth = 0;
    }
    gapOffset += unit.filter((c) => c === null).length;
  }
  return Math.max(1, rows);
}

// rowWidthPx — опційний (дефолт REFERENCE_ROW_WIDTH_PX): РЕАЛЬНА вправа
// сцени завжди викликає БЕЗ другого аргументу (її вигляд не залежить від
// вимірювання контейнера, незмінний цією задачею); практика "Робота над
// помилками" (letterGapsPracticeLayout нижче) підставляє РЕАЛЬНУ виміряну
// ширину, коли вона готова.
export function estimateLetterGapsCardRows(
  chars: (string | null)[],
  hiddenLetters: string[],
  rowWidthPx: number = REFERENCE_ROW_WIDTH_PX
): number {
  return estimateLetterGapsCardLayoutRows(chars, hiddenLetters, rowWidthPx);
}

// k — скільки однакових плиток-літер (FIXED_CELL_PX) влазить в один рядок
// ширини rowWidthPx.
function rearrangementTilesPerLine(rowWidthPx: number): number {
  return Math.max(1, Math.floor((rowWidthPx + FIXED_CELL_GAP_PX) / (FIXED_CELL_PX + FIXED_CELL_GAP_PX)));
}

// letter_rearrangement: плитки-літери без змістовних груп, усі однакової
// ширини — звичайний жадібний перенос (не balanced chunkIntoRows,
// use-working-tile-layout.ts — та функція є лише для РЕАЛЬНОГО рендеру
// вправи на сцені, не для цього pure-оцінювача; жадібний розподіл тут
// точно відповідає звичайному flex-wrap у браузері). rowWidthPx — той
// самий принцип, що estimateLetterGapsCardRows вище (дефолт REFERENCE_
// ROW_WIDTH_PX для реальної вправи, реальна виміряна ширина для практики).
export function estimateLetterRearrangementCardRows(letterCount: number, rowWidthPx: number = REFERENCE_ROW_WIDTH_PX): number {
  const k = rearrangementTilesPerLine(rowWidthPx);
  return Math.max(1, Math.ceil(letterCount / k));
}

// Задача "simplification of the card layout for letter practice" — ЄДИНА
// класифікація практики: "short" (1 рядок плиток/одиниць ПІСЛЯ
// збалансованого переносу) чи "long" (2+ рядки) — wideSingleLine і
// content-width картки з попередньої задачі ПОВНІСТЮ прибрані: УСІ картки
// завжди half-width, однакового розміру.
export type PracticeCardClass = "short" | "long";

// letter_rearrangement: n однакових плиток-ширини FIXED_CELL_PX — forced-
// break index (0-based, "вставити розрив ПІСЛЯ плитки з цим індексом")
// подається напряму в SortableTileRow (sortable-tile-row.tsx).
export function letterRearrangementPracticeLayout(
  letterCount: number,
  rowWidthPx: number
): { cardClass: PracticeCardClass; forcedBreakAfterIndex: number | null } {
  const itemWidths = Array.from({ length: letterCount }, () => FIXED_CELL_PX);
  const rows = packBalancedRowCounts(itemWidths, rowWidthPx, FIXED_CELL_GAP_PX).length;
  const forcedBreakAfterIndex = forcedBreakIndexFor(itemWidths, rowWidthPx, FIXED_CELL_GAP_PX);
  return { cardClass: rows <= 1 ? "short" : "long", forcedBreakAfterIndex };
}

// Задача "the last line must not end with a single unit either, and a
// lone visible letter attached to nothing must not be alone on a line" —
// descriptor одного форсованого розриву для letter_gaps, на ДВОХ можливих
// рівнях вкладеності DOM (той самий, що renderWordCard, letter-gaps.tsx):
// - "afterUnit": між двома ЦІЛИМИ одиницями переносу (.word-unit-group) у
//   .word-units-row — найбільш типовий випадок (фраза з кількох слів);
// - "afterChunk": УСЕРЕДИНІ ОДНІЄЇ (завеликої, що сама не влазить у рядок)
//   одиниці, між двома її власними силабічними фрагментами
//   (.syllable-chunk) — коли саме ОДНЕ слово переноситься на 2+ власних
//   рядки (задача явно називає цей випадок: "lone visible letter").
export type LetterGapsForcedBreak =
  | { kind: "afterUnit"; unitIndex: number }
  | { kind: "afterChunk"; unitIndex: number; chunkIndex: number };

// Задача "method: fill lines greedily... for letter_gaps the units are
// the real unbreakable units... word groups break at word boundaries
// first" — фраза проходиться як ПОСЛІДОВНІСТЬ сегментів: "пробіг" (run) із
// суміжних ЗВИЧАЙНИХ (що влазять у рядок самі) одиниць пакується РАЗОМ
// (слова течуть одним текстовим потоком, як і раніше); одиниця, що сама
// ширша за рядок, закриває поточний пробіг і стає ОКРЕМИМ сегментом
// власних силабічних фрагментів (той самий принцип, що
// estimateLetterGapsCardLayoutRows вище, не змінюється тут природним
// потоком — фікс/розрив застосовується ЛИШЕ до ОСТАННЬОГО сегмента, бо
// лише ВІН визначає, як виглядає останній рядок картки; усі попередні межі
// сегментів/рядків лишаються точно природним потоком, без жодного
// форсованого розриву там — природний CSS-перенос і наша оцінка вже
// узгоджені в усіх ЦИХ місцях).
export function letterGapsPracticeLayout(
  chars: (string | null)[],
  hiddenLetters: string[],
  rowWidthPx: number
): { cardClass: PracticeCardClass; forcedBreak: LetterGapsForcedBreak | null } {
  const units = splitPhraseUnits(chars);
  type Segment =
    | { kind: "units"; startUnitIndex: number; widths: number[] }
    | { kind: "chunk"; unitIndex: number; widths: number[] };
  const segments: Segment[] = [];
  let runStartUnitIndex = -1;
  let runWidths: number[] = [];
  let gapOffset = 0;
  for (let ui = 0; ui < units.length; ui++) {
    const unit = units[ui];
    const w = cellsWidth(unit);
    if (w <= rowWidthPx) {
      if (runWidths.length === 0) runStartUnitIndex = ui;
      runWidths.push(w);
    } else {
      if (runWidths.length > 0) {
        segments.push({ kind: "units", startUnitIndex: runStartUnitIndex, widths: runWidths });
        runWidths = [];
      }
      const word = reconstructUnitWord(unit, hiddenLetters, gapOffset);
      const chunkWidths = sliceUnitByChunks(unit, splitIntoSyllableChunks(word)).map(cellsWidth);
      segments.push({ kind: "chunk", unitIndex: ui, widths: chunkWidths });
    }
    gapOffset += unit.filter((c) => c === null).length;
  }
  if (runWidths.length > 0) segments.push({ kind: "units", startUnitIndex: runStartUnitIndex, widths: runWidths });

  if (segments.length === 0) return { cardClass: "short", forcedBreak: null };

  let rows = 0;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    const gapPx = seg.kind === "units" ? WORD_GAP_PX : 0;
    rows += packIntoRowsCounts(seg.widths, rowWidthPx, gapPx).length;
  }
  const lastSeg = segments[segments.length - 1];
  const lastGapPx = lastSeg.kind === "units" ? WORD_GAP_PX : 0;
  rows += packBalancedRowCounts(lastSeg.widths, rowWidthPx, lastGapPx).length;

  const breakIdx = forcedBreakIndexFor(lastSeg.widths, rowWidthPx, lastGapPx);
  const forcedBreak: LetterGapsForcedBreak | null =
    breakIdx === null
      ? null
      : lastSeg.kind === "units"
        ? { kind: "afterUnit", unitIndex: lastSeg.startUnitIndex + breakIdx }
        : { kind: "afterChunk", unitIndex: lastSeg.unitIndex, chunkIndex: breakIdx };

  return { cardClass: rows <= 1 ? "short" : "long", forcedBreak };
}

// Мішає картки за оціненою кількістю рядків — сортування за зростанням,
// СТІЙКЕ (зберігає вихідний порядок у межах того самого значення rows; явний
// тай-брейк за вихідним індексом, не лише надія на стабільність Array.sort,
// хоч вона й гарантована з ES2019). Пакування по дві картки в рядок
// 2-колонкового grid — ГОТОВЕ одразу після сортування: сусідні елементи
// відсортованого масиву природньо мають рівне rows (та сама "парна" група),
// а непарний залишок групи опиняється РІВНО перед першою карткою наступної
// групи — саме "останній непарний пара з першим наступного класу" з
// завдання, без додаткової логіки парування. Остання картка при непарній
// загальній кількості лишається одна (порожня друга клітинка grid-рядка —
// стандартна поведінка CSS grid). ЦЯ функція лишається РІВНО для РЕАЛЬНОЇ
// вправи сцени (displayOrder/blockDisplayOrder) — незмінна цією задачею.
export function orderByEstimatedRows(rows: number[]): number[] {
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map(({ i }) => i);
}
