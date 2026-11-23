// Оцінка кількості рядків картки-слова letter_gaps/letter_rearrangement —
// ЧИСТА функція від даних слова (жодного DOM-вимірювання, жодного
// useEffect/ResizeObserver): детермінована (той самий вхід → той самий
// вихід), однакова на сервері й клієнті, незмінна до/після перевірки, при
// перемиканні блоку й після перезавантаження з тими самими даними —
// замінює колишнє useTwoColumnWordOrder (виміряна висота вмісту в
// браузері), видалене разом із порогами SINGLE_WORD_SPAN_THRESHOLD/
// PHRASE_SPAN_THRESHOLD (word-list-layout.ts), що оцінювали лише "чи треба
// картці повний рядок", а не реальну кількість рядків клітинок.
import { FIXED_CELL_PX, FIXED_CELL_GAP_PX, COLUMN_GAP_PX } from "@/components/exercises/use-working-tile-layout";
import { splitPhraseUnits } from "./word-list-layout";
import { groupChars } from "./letter-cell-groups";
import { splitIntoSyllableChunks, reconstructUnitWord, sliceUnitByChunks } from "./syllable-split";

// Референсна внутрішня ширина рядка картки — half-width картка на
// НАЙВУЖЧОМУ 2-колонковому вікні (768px, TWO_COLUMN_BREAKPOINT_PX):
// наближення (та сама величина для ОБОХ вправ — один названий константний
// орієнтир, не реальний замір конкретного екрана, оцінка лише впорядковує
// картки за КІЛЬКІСТЮ рядків, не відтворює пікселі).
//
// Перекалібровано (задача "orphan detection did not fire for 9/10-tile
// words") з 300 на 330 — емпірична калібрувальна точка зі скріншота:
// letter_rearrangement, 9 однакових плиток-літер (FIXED_CELL_PX=32,
// FIXED_CELL_GAP_PX=3.4) насправді влазять в ОДИН рядок half-width картки,
// 10 плиток переносять РІВНО 1 плитку на другий рядок (а не 2) — тобто
// реальна місткість рядка (k, rearrangementTilesPerLine нижче) РІВНО 9
// плиток, не 8. floor((R+3.4)/35.4)=9 вимагає R у [315.2, 350.6) — 300
// (floor=8) був ЗАНАДТО малий, 330 (floor=9) — усередині потрібного
// діапазону. Той самий k=9 також узгоджується з тим, що картка 5 (9
// плиток) на скріншоті вже НЕ переноситься (рядок 1) — обидва приклади
// зі ЗНІМКА однієї вправи мусять збігатись з ОДНИМ k, що й підтверджує
// це значення, а не довільний вибір. letter_gaps (слова-одиниці, не
// однакові плитки) лишається коректним для БУДЬ-ЯКОГО R у широкому
// діапазоні — перевірено: існуючі тести (estimate-card-rows.test.ts)
// далі проходять із новим значенням без зміни своїх вихідних даних (крім
// одного прикладу, де межа "не влазить навіть на full-width" зрушилась —
// див. коментар там).
export const REFERENCE_ROW_WIDTH_PX = 330;

// Задача "orphan card must become full-width, not half-width with a lone
// trailing tile" — той самий орієнтир для full-width картки: дві
// half-width колонки РАЗОМ, плюс gap МІЖ колонками, що full-width картка
// "забирає назад" собі (COLUMN_GAP_PX, use-working-tile-layout.ts) — та ж
// сама логіка наближення, не піксель-perfect заміри.
export const FULL_ROW_WIDTH_PX = REFERENCE_ROW_WIDTH_PX * 2 + COLUMN_GAP_PX;

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
// (не лише кількість рядків) — задача "orphan card" потребує саме останнє
// число (скільки фрагментів лишилось на останньому рядку слова), не лише
// rows.length. Порожній вхід (елемент сам ширший за rowWidth) усе одно
// займає рівно один (порожній) рядок — не нуль, той самий принцип, що й
// раніше.
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

// letter_gaps: одиниці переносу (артикль/"se"/слово) — атомарні, пакуються
// зліва праворуч у звичайному текстовому потоці (packIntoRowsCounts,
// WORD_GAP_PX між одиницями). Одиниця, що сама ширша за рядок, НЕ ділить
// рядок із сусідами (спрощення для оцінки — реальний CSS-рендер теж
// переносить таку одиницю на свій рядок цілком, перш ніж вона почне
// розбиватись на фрагменти): закриває поточний рядок, займає
// packIntoRowsCounts(фрагменти, rowWidth, 0) власних рядків (фрагменти того
// самого слова — без проміжку між собою, splitIntoSyllableChunks вище,
// .syllable-chunk у globals.css), наступна одиниця починає новий рядок.
// rowWidthPx — той самий підрахунок на ДОВІЛЬНІЙ ширині рядка
// (REFERENCE_ROW_WIDTH_PX для half-width, FULL_ROW_WIDTH_PX для
// full-width) — викликачі нижче (estimateLetterGapsCardRows,
// letterGapsCardClass) підставляють потрібну.
function estimateLetterGapsCardLayoutRows(chars: (string | null)[], hiddenLetters: string[], rowWidthPx: number): number {
  const units = splitPhraseUnits(chars);
  // rowUsedWidth === 0 означає "рядок ще не відкрито" — наступна звичайна
  // одиниця відкриває його (rows++); інакше вона або ділить поточний рядок
  // (влазить разом із WORD_GAP_PX), або закриває його й відкриває новий.
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
      // Завелика одиниця ніколи не ділить рядок із сусідами (ні з
      // попередньою, ні з наступною) — закриває поточний рядок (якщо був)
      // і займає ЛИШЕ СВОЇ packIntoRowsCounts(...) рядки; наступна одиниця
      // відкриває новий рядок (rowUsedWidth = 0 нижче).
      const word = reconstructUnitWord(unit, hiddenLetters, gapOffset);
      const chunkWidths = sliceUnitByChunks(unit, splitIntoSyllableChunks(word)).map(cellsWidth);
      rows += packIntoRowsCounts(chunkWidths, rowWidthPx, 0).length;
      rowUsedWidth = 0;
    }
    gapOffset += unit.filter((c) => c === null).length;
  }
  return Math.max(1, rows);
}

export function estimateLetterGapsCardRows(chars: (string | null)[], hiddenLetters: string[]): number {
  return estimateLetterGapsCardLayoutRows(chars, hiddenLetters, REFERENCE_ROW_WIDTH_PX);
}

// Задача "unified card layout rule for letter practice" — ОДНА класифікація
// картки практики за "overflow" (скільки тайлів/плиток НЕ влазить на
// перший рядок half-width картки, якби все слово/фразу покласти в ОДИН
// уявний рядок) і за тим, чи слово дійсно влазить в ОДИН рядок при
// full-width (реальний пошаговий естіматор — той самий, що впорядковує
// РЕАЛЬНУ вправу — а не наївне порівняння сум ширин, бо один-єдиний
// завеликий фрагмент слова МІГ БИ розбитись на кілька своїх рядків навіть
// коли сума виглядає "влазить"):
//   overflow <= 0            -> "short" (уже влазить в один рядок half-width)
//   overflow в {1, 2} І влазить в один рядок на full-width -> "wideSingleLine"
//   інакше (overflow >= 3, АБО не влазить в один рядок навіть на full-width)
//                             -> "long"
// Порогові числа (1, 2, 3) — буквально з задачі ("слову не вистачає 1 чи 2
// літер" -> wideSingleLine; "3 чи більше" -> long), не довільний вибір.
export type PracticeCardClass = "short" | "long" | "wideSingleLine";

export function classifyPracticeCard(overflowTiles: number, fitsOneLineAtFull: boolean): PracticeCardClass {
  if (overflowTiles <= 0) return "short";
  if (overflowTiles <= 2 && fitsOneLineAtFull) return "wideSingleLine";
  return "long";
}

// Скільки "тайлів" (клітинок FIXED_CELL_PX+FIXED_CELL_GAP_PX завширшки)
// перевищує contentWidthPx понад REFERENCE_ROW_WIDTH_PX (half-width
// картка) — ціле число, округлене ВГОРУ (навіть 0.1 тайла зайвого —
// це вже "не влазить", частковий тайл не можна відобразити). <=0 -> 0.
function overflowTilesFor(contentWidthPx: number): number {
  const overflowPx = contentWidthPx - REFERENCE_ROW_WIDTH_PX;
  if (overflowPx <= 0) return 0;
  return Math.ceil(overflowPx / (FIXED_CELL_PX + FIXED_CELL_GAP_PX));
}

// letter_gaps: overflow — з letterGapsSingleLineContentWidth (уявний один
// рядок, сума всіх одиниць переносу + проміжки, БЕЗ обмеження ширини
// рядка); "влазить в один рядок на full-width" — РЕАЛЬНИЙ пошаговий
// естіматор (estimateLetterGapsCardLayout) на FULL_ROW_WIDTH_PX, рядків
// рівно 1 — не те саме порівняння сум, бо один завеликий фрагмент слова
// (сам ширший за рядок) розбивається на СВОЇ рядки незалежно від суми.
export function letterGapsCardClass(chars: (string | null)[], hiddenLetters: string[]): PracticeCardClass {
  const overflowTiles = overflowTilesFor(letterGapsSingleLineContentWidth(chars));
  const fitsOneLineAtFull = estimateLetterGapsCardLayoutRows(chars, hiddenLetters, FULL_ROW_WIDTH_PX) === 1;
  return classifyPracticeCard(overflowTiles, fitsOneLineAtFull);
}

// Скільки МІСЦЯ займе слово/фраза, якщо покласти ВСІ її одиниці переносу в
// ОДИН уявний рядок (WORD_GAP_PX між ними, як і в звичайному пакуванні
// вище) — БЕЗ урахування будь-якої ширини рядка-обмеження. Використовується
// ДВІЧІ: (1) overflowTilesFor вище — наскільки це перевищує
// REFERENCE_ROW_WIDTH_PX, у "тайлах"; (2) wide-card-width.ts —
// letterGapsWideCardWidthPx, фактична ширина "wideSingleLine"-картки (за
// визначенням класу — слово й так влазить у РІВНО один рядок на
// full-width, тож ця сума ТОЧНО дорівнює ширині того єдиного рядка, не
// переоцінка).
export function letterGapsSingleLineContentWidth(chars: (string | null)[]): number {
  const units = splitPhraseUnits(chars);
  return units.reduce((sum, unit, i) => sum + (i > 0 ? WORD_GAP_PX : 0) + cellsWidth(unit), 0);
}

// Скільки однакових плиток-літер (FIXED_CELL_PX) влазить в один рядок
// ширини rowWidthPx — той самий розрахунок, що раніше був "захардкожений"
// лише на REFERENCE_ROW_WIDTH_PX (half-width); задача "orphan card"
// потребує того самого для FULL_ROW_WIDTH_PX теж.
function rearrangementTilesPerLine(rowWidthPx: number): number {
  return Math.max(1, Math.floor((rowWidthPx + FIXED_CELL_GAP_PX) / (FIXED_CELL_PX + FIXED_CELL_GAP_PX)));
}

// letter_rearrangement: плитки-літери без змістовних груп, усі однакової
// ширини — звичайний жадібний перенос (не balanced chunkIntoRows,
// use-working-tile-layout.ts — та функція є лише для РЕАЛЬНОГО рендеру
// вправи на сцені, не для цього pure-оцінювача; жадібний розподіл тут
// точно відповідає звичайному flex-wrap у браузері, те саме явище, що й
// спричиняє "сирітку" в задачі). k — скільки плиток влазить у рядок.
export function estimateLetterRearrangementCardRows(letterCount: number, rowWidthPx: number = REFERENCE_ROW_WIDTH_PX): number {
  const k = rearrangementTilesPerLine(rowWidthPx);
  return Math.max(1, Math.ceil(letterCount / k));
}

// letter_rearrangement: той самий принцип, що letterGapsCardClass —
// overflow з letterRearrangementSingleLineContentWidth (однакові плитки,
// один уявний рядок), "влазить в один рядок на full-width" — РЕАЛЬНИЙ
// estimateLetterRearrangementCardRows на FULL_ROW_WIDTH_PX, рядків рівно 1.
export function letterRearrangementCardClass(letterCount: number): PracticeCardClass {
  const overflowTiles = overflowTilesFor(letterRearrangementSingleLineContentWidth(letterCount));
  const fitsOneLineAtFull = estimateLetterRearrangementCardRows(letterCount, FULL_ROW_WIDTH_PX) === 1;
  return classifyPracticeCard(overflowTiles, fitsOneLineAtFull);
}

// Задача "wide standalone card should be content-width, not full row
// width" — той самий принцип, що letterGapsSingleLineContentWidth: скільки
// МІСЦЯ займуть ВСІ плитки-літери в ОДНОМУ рядку (без обмеження ширини).
export function letterRearrangementSingleLineContentWidth(letterCount: number): number {
  if (letterCount <= 0) return 0;
  return letterCount * FIXED_CELL_PX + (letterCount - 1) * FIXED_CELL_GAP_PX;
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
// стандартна поведінка CSS grid, той самий принцип, що раніше з col-span).
export function orderByEstimatedRows(rows: number[]): number[] {
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map(({ i }) => i);
}
