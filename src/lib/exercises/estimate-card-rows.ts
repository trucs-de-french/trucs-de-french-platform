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
// Використовується ЛИШЕ letterRearrangementPracticeLayout (однакові
// плитки-літери, FIXED_CELL_PX — ТОЧНИЙ CSS-розмір, не наближення, тож
// природний перенос і наша оцінка вже узгоджені на КОЖНІЙ межі рядка
// ОКРІМ тієї, що фікс явно перевизначає — на відміну від letter_gaps
// нижче, де GIVEN_LETTER_WIDTH_PX лише наближення реальної ширини
// шрифту, тож природний перенос МІГ БИ розійтися з оцінкою на БУДЬ-ЯКІЙ
// межі, не лише останній — звідси там повний набір розривів
// (breakIndicesForCounts), не лише один).
export function forcedBreakIndexFor(itemWidths: number[], rowWidthPx: number, gapPx: number): number | null {
  const natural = packIntoRowsCounts(itemWidths, rowWidthPx, gapPx);
  const last = natural.length - 1;
  if (last < 1 || natural[last] !== 1 || natural[last - 1] < 2) return null;
  return itemWidths.length - 3;
}

// Задача "pack word groups greedily on a line" — усі межі рядків (0-based
// індекс елемента, "вставити розрив ПІСЛЯ нього") з ГОТОВОГО масиву
// підрахунків (packIntoRowsCounts чи packBalancedRowCounts) — ОКРІМ
// останньої (після фінального рядка розрив не потрібен, далі просто нічого
// нема). На відміну від forcedBreakIndexFor вище (ОДИН розрив, що фіксує
// розбіжність з природним потоком), ця функція повертає ПОВНИЙ,
// явний набір розривів для КОЖНОЇ межі — рендерер (letter-gaps.tsx)
// вставляє DOM-елемент розриву в КОЖНІЙ з цих позицій, тож оцінка (де
// розбивати) і рендер (де РЕАЛЬНО розбито) гарантовано збігаються на
// КОЖНІЙ межі, не лише на тій, де природний перенос МІГ БИ (через
// наближену ширину символу, GIVEN_LETTER_WIDTH_PX) розійтися з оцінкою.
export function breakIndicesForCounts(counts: number[]): number[] {
  const breaks: number[] = [];
  let cumulative = 0;
  for (let i = 0; i < counts.length - 1; i++) {
    cumulative += counts[i];
    breaks.push(cumulative - 1);
  }
  return breaks;
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
// подається напряму в SortableTileRow (sortable-tile-row.tsx). lines —
// задача "pack word groups greedily on a line" (п.2, pairing): готова
// кількість рядків ПІСЛЯ збалансованого переносу, потрібна
// pairPracticeItems (flat-practice-layout.ts) для вибору "найкоротшої
// довгої картки" при парному/непарному мішаному парuванні.
export function letterRearrangementPracticeLayout(
  letterCount: number,
  rowWidthPx: number
): { cardClass: PracticeCardClass; lines: number; forcedBreakAfterIndex: number | null } {
  const itemWidths = Array.from({ length: letterCount }, () => FIXED_CELL_PX);
  const rows = packBalancedRowCounts(itemWidths, rowWidthPx, FIXED_CELL_GAP_PX).length;
  const forcedBreakAfterIndex = forcedBreakIndexFor(itemWidths, rowWidthPx, FIXED_CELL_GAP_PX);
  return { cardClass: rows <= 1 ? "short" : "long", lines: rows, forcedBreakAfterIndex };
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

// Задача "pack word groups greedily on a line" — фраза проходиться як
// ПОСЛІДОВНІСТЬ сегментів: "пробіг" (run) із суміжних ЗВИЧАЙНИХ (що
// влазять у рядок самі) одиниць пакується РАЗОМ (слова течуть одним
// текстовим потоком, жадібно — "une" йде на той самий рядок, що "vider",
// щойно воно влазить разом із WORD_GAP_PX, НЕЗАЛЕЖНО від того, скільки
// слів перед ним уже на цьому рядку); одиниця, що сама ширша за рядок,
// закриває поточний пробіг і стає ОКРЕМИМ сегментом власних силабічних
// фрагментів (той самий принцип, що estimateLetterGapsCardLayoutRows
// вище, тут не змінюється).
//
// ВАЖЛИВО (задача явно це вимагає): "only a single word group that does
// not fit a whole line is broken inside by the balanced-wrapping rule" —
// правило "останній рядок не має лишатись ОДНИМ елементом"
// (packBalancedRowCounts) застосовується ЛИШЕ до "chunk"-сегментів
// (ОДНЕ завелике слово, що само розбивається на фрагменти) — НЕ до
// "units"-сегментів (кілька окремих слів у фразі): слово-одинак на
// останньому рядку фрази (наприклад "assiette" саме після "vider une") —
// це звичайний, коректний перенос тексту, не помилка розмітки (на
// відміну від ОДНОГО силабічного фрагмента довгого слова, що й справді
// виглядає "відірваним"). chunkWithoutSingleton-подібний фікс тут НЕ
// застосовується НАВІТЬ до останнього units-сегмента.
//
// ПОВНИЙ набір розривів (breakIndicesForCounts), НЕ лише один (на
// відміну від попередньої версії) — для КОЖНОГО сегмента (і units, і
// chunk), на КОЖНІЙ його внутрішній межі рядка: природний CSS inline-
// block перенос спирається на GIVEN_LETTER_WIDTH_PX — НАБЛИЖЕННЯ
// справжньої ширини шрифту (не точний CSS-розмір, як FIXED_CELL_PX
// плиток-літер) — тож природний перенос браузера МІГ БИ розійтися з
// нашою оцінкою на БУДЬ-ЯКІЙ межі рядка, не лише останній; явний розрив
// на КОЖНІЙ межі гарантує, що РЕНДЕР (де реально розбито) і ОЦІНКА (де
// має бути розбито) завжди узгоджені, незалежно від точності наближення
// ширини символу.
export function letterGapsPracticeLayout(
  chars: (string | null)[],
  hiddenLetters: string[],
  rowWidthPx: number
): { cardClass: PracticeCardClass; lines: number; forcedBreaks: LetterGapsForcedBreak[] } {
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

  if (segments.length === 0) return { cardClass: "short", lines: 1, forcedBreaks: [] };

  let rows = 0;
  const forcedBreaks: LetterGapsForcedBreak[] = [];
  for (const seg of segments) {
    if (seg.kind === "units") {
      // Жадібне пакування СЛОВО-ГРУП — БЕЗ фіксу "останній рядок не 1
      // елемент" (задача: самотнє слово в кінці фрази — не помилка).
      const counts = packIntoRowsCounts(seg.widths, rowWidthPx, WORD_GAP_PX);
      rows += counts.length;
      for (const idx of breakIndicesForCounts(counts)) {
        forcedBreaks.push({ kind: "afterUnit", unitIndex: seg.startUnitIndex + idx });
      }
    } else {
      // ОДНЕ завелике слово, власні силабічні фрагменти — НЕЗМІННО, той
      // самий єдиний фікс/розрив, що й до цієї задачі (forcedBreakIndexFor,
      // ОДИН break): задача "pack word groups greedily on a line"
      // стосується ЛИШЕ пакування СЛОВО-ГРУП (units-сегмент вище), не
      // внутрішнього розбиття ОДНОГО завеликого слова на силабічні
      // фрагменти — той механізм лишається без змін.
      rows += packBalancedRowCounts(seg.widths, rowWidthPx, 0).length;
      const breakIdx = forcedBreakIndexFor(seg.widths, rowWidthPx, 0);
      if (breakIdx !== null) {
        forcedBreaks.push({ kind: "afterChunk", unitIndex: seg.unitIndex, chunkIndex: breakIdx });
      }
    }
  }

  return { cardClass: rows <= 1 ? "short" : "long", lines: rows, forcedBreaks };
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
