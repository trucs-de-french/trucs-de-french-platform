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
// приблизно 300px (та сама величина для ОБОХ вправ — один названий
// константний орієнтир, не реальний замір конкретного екрана, оцінка
// лише впорядковує картки за КІЛЬКІСТЮ рядків, не відтворює пікселі).
export const REFERENCE_ROW_WIDTH_PX = 300;

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

type GapsCardLayout = { rows: number; lastLineCount: number };

// letter_gaps: одиниці переносу (артикль/"se"/слово) — атомарні, пакуються
// зліва праворуч у звичайному текстовому потоці (packIntoRowsCounts,
// WORD_GAP_PX між одиницями). Одиниця, що сама ширша за рядок, НЕ ділить
// рядок із сусідами (спрощення для оцінки — реальний CSS-рендер теж
// переносить таку одиницю на свій рядок цілком, перш ніж вона почне
// розбиватись на фрагменти): закриває поточний рядок, займає
// packIntoRowsCounts(фрагменти, rowWidth, 0) власних рядків (фрагменти того
// самого слова — без проміжку між собою, splitIntoSyllableChunks вище,
// .syllable-chunk у globals.css), наступна одиниця починає новий рядок.
// rowWidthPx — задача "orphan card": той самий підрахунок на ДОВІЛЬНІЙ
// ширині рядка (REFERENCE_ROW_WIDTH_PX для half-width, FULL_ROW_WIDTH_PX
// для full-width) — викликачі нижче (estimateLetterGapsCardRows,
// letterGapsIsOrphan, letterGapsOverflowsColumn) підставляють потрібну.
// lastLineCount — скільки "тайлів" (одиниць переносу, що пакуються разом
// на рядку, АБО силабічних фрагментів одного завеликого слова) лишилось на
// ОСТАННЬОМУ рядку картки — саме це визначає "сирітку" (lastLineCount===1
// при rows>=2).
function estimateLetterGapsCardLayout(
  chars: (string | null)[],
  hiddenLetters: string[],
  rowWidthPx: number
): GapsCardLayout {
  const units = splitPhraseUnits(chars);
  // rowUsedWidth === 0 означає "рядок ще не відкрито" — наступна звичайна
  // одиниця відкриває його (rows++); інакше вона або ділить поточний рядок
  // (влазить разом із WORD_GAP_PX), або закриває його й відкриває новий.
  let rows = 0;
  let rowUsedWidth = 0;
  let rowUnitCount = 0;
  let lastLineCount = 0;
  let gapOffset = 0;
  for (const unit of units) {
    const unitWidth = cellsWidth(unit);
    if (unitWidth <= rowWidthPx) {
      if (rowUsedWidth === 0) {
        rows++;
        rowUsedWidth = unitWidth;
        rowUnitCount = 1;
      } else if (rowUsedWidth + WORD_GAP_PX + unitWidth <= rowWidthPx) {
        rowUsedWidth += WORD_GAP_PX + unitWidth;
        rowUnitCount += 1;
      } else {
        rows++;
        rowUsedWidth = unitWidth;
        rowUnitCount = 1;
      }
      lastLineCount = rowUnitCount;
    } else {
      // Завелика одиниця ніколи не ділить рядок із сусідами (ні з
      // попередньою, ні з наступною) — закриває поточний рядок (якщо був)
      // і займає ЛИШЕ СВОЇ packIntoRowsCounts(...) рядки; наступна одиниця
      // відкриває новий рядок (rowUsedWidth = 0 нижче).
      const word = reconstructUnitWord(unit, hiddenLetters, gapOffset);
      const chunkWidths = sliceUnitByChunks(unit, splitIntoSyllableChunks(word)).map(cellsWidth);
      const chunkCounts = packIntoRowsCounts(chunkWidths, rowWidthPx, 0);
      rows += chunkCounts.length;
      lastLineCount = chunkCounts[chunkCounts.length - 1] ?? 1;
      rowUsedWidth = 0;
      rowUnitCount = 0;
    }
    gapOffset += unit.filter((c) => c === null).length;
  }
  return { rows: Math.max(1, rows), lastLineCount: rows === 0 ? 1 : lastLineCount };
}

export function estimateLetterGapsCardRows(chars: (string | null)[], hiddenLetters: string[]): number {
  return estimateLetterGapsCardLayout(chars, hiddenLetters, REFERENCE_ROW_WIDTH_PX).rows;
}

// Задача "a lone card in the last row must stay half-width" — чи є в слові
// одиниця, що НАВІТЬ після розбиття на силабічні фрагменти лишає бодай один
// фрагмент ШИРШИМ за FULL_ROW_WIDTH_PX (задача "orphan card": тепер
// найширше доступне місце — full-width картка, не half-width, бо
// "сирітки"/orphan-картки вже й так отримують full-width нижче — цей
// виняток лишається лише для СПРАВДІ нерозривного слова, що не влазить НАВІТЬ
// туди) — це і є "контент, що насправді не влазить у жодну колонку" (дуже
// довге, нерозривне слово), на відміну від звичайного "картка потребує
// кілька рядків" (просто переносить слова/фрагменти рядками, завжди влазить,
// full-width НЕ потрібен з цієї причини). pairPracticeItems
// (flat-practice-layout.ts) використовує це поруч з orphan, щоб вирішити,
// чи картка лишається full-width.
export function letterGapsOverflowsColumn(chars: (string | null)[], hiddenLetters: string[]): boolean {
  const units = splitPhraseUnits(chars);
  let gapOffset = 0;
  for (const unit of units) {
    const unitWidth = cellsWidth(unit);
    if (unitWidth > FULL_ROW_WIDTH_PX) {
      const word = reconstructUnitWord(unit, hiddenLetters, gapOffset);
      const chunkWidths = sliceUnitByChunks(unit, splitIntoSyllableChunks(word)).map(cellsWidth);
      if (chunkWidths.some((w) => w > FULL_ROW_WIDTH_PX)) return true;
    }
    gapOffset += unit.filter((c) => c === null).length;
  }
  return false;
}

// Задача "orphan card" — "сирітка": при half-width картка потребує 2+
// рядки (rows>=2), і ОСТАННІЙ рядок тримає РІВНО 1 "тайл" (слово-одиницю
// чи силабічний фрагмент, lastLineCount===1), АЛЕ при full-width (обидві
// колонки) ВСЕ слово влазить в ОДИН рядок (rows===1 на FULL_ROW_WIDTH_PX) —
// саме цей і тільки цей випадок: "той самий текст, що виглядає, як помилка
// розмітки, half-width, насправді прекрасно влазить в один рядок, якщо
// дати йому обидві колонки". Якщо слово потребує 2+ рядки НАВІТЬ при
// full-width — це звичайна довга картка (НЕ сирітка, пара-з-парою, задача
// явно вимагає цього винятку).
export function letterGapsIsOrphan(chars: (string | null)[], hiddenLetters: string[]): boolean {
  const half = estimateLetterGapsCardLayout(chars, hiddenLetters, REFERENCE_ROW_WIDTH_PX);
  if (half.rows < 2 || half.lastLineCount !== 1) return false;
  const full = estimateLetterGapsCardLayout(chars, hiddenLetters, FULL_ROW_WIDTH_PX);
  return full.rows === 1;
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

// Задача "orphan card" — той самий принцип, що letterGapsIsOrphan: при
// half-width слово потребує 2+ рядки, і ОСТАННІЙ тримає РІВНО 1 плитку
// (greedy-поділ однакових плиток: lastLineCount = letterCount - k*(rows-1)),
// АЛЕ при full-width усе слово влазить в ОДИН рядок.
export function letterRearrangementIsOrphan(letterCount: number): boolean {
  const kHalf = rearrangementTilesPerLine(REFERENCE_ROW_WIDTH_PX);
  const halfRows = Math.max(1, Math.ceil(letterCount / kHalf));
  if (halfRows < 2) return false;
  const lastLineCount = letterCount - kHalf * (halfRows - 1);
  if (lastLineCount !== 1) return false;
  const kFull = rearrangementTilesPerLine(FULL_ROW_WIDTH_PX);
  const fullRows = Math.max(1, Math.ceil(letterCount / kFull));
  return fullRows === 1;
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
