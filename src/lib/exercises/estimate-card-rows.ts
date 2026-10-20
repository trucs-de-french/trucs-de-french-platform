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
// приблизно 300px (та сама величина для ОБОХ вправ — один названий
// константний орієнтир, не реальний замір конкретного екрана, оцінка
// лише впорядковує картки за КІЛЬКІСТЮ рядків, не відтворює пікселі).
export const REFERENCE_ROW_WIDTH_PX = 300;

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
// і елемент починає новий. Порожній рядок (елемент сам ширший за rowWidth)
// усе одно займає рівно один рядок — не нуль.
function packIntoRows(itemWidths: number[], rowWidth: number, gapPx: number): number {
  if (itemWidths.length === 0) return 1;
  let rows = 1;
  let used = 0;
  for (const w of itemWidths) {
    const needed = used === 0 ? w : used + gapPx + w;
    if (used === 0 || needed <= rowWidth) {
      used = needed;
    } else {
      rows++;
      used = w;
    }
  }
  return rows;
}

// letter_gaps: одиниці переносу (артикль/"se"/слово) — атомарні, пакуються
// зліва праворуч у звичайному текстовому потоці (packIntoRows,
// WORD_GAP_PX між одиницями). Одиниця, що сама ширша за рядок, НЕ ділить
// рядок із сусідами (спрощення для оцінки — реальний CSS-рендер теж
// переносить таку одиницю на свій рядок цілком, перш ніж вона почне
// розбиватись на фрагменти): закриває поточний рядок, займає
// packIntoRows(фрагменти, rowWidth, 0) власних рядків (фрагменти того
// самого слова — без проміжку між собою, splitIntoSyllableChunks вище,
// .syllable-chunk у globals.css), наступна одиниця починає новий рядок.
export function estimateLetterGapsCardRows(chars: (string | null)[], hiddenLetters: string[]): number {
  const units = splitPhraseUnits(chars);
  // rowUsedWidth === 0 означає "рядок ще не відкрито" — наступна звичайна
  // одиниця відкриває його (rows++); інакше вона або ділить поточний рядок
  // (влазить разом із WORD_GAP_PX), або закриває його й відкриває новий.
  let rows = 0;
  let rowUsedWidth = 0;
  let gapOffset = 0;
  for (const unit of units) {
    const unitWidth = cellsWidth(unit);
    if (unitWidth <= REFERENCE_ROW_WIDTH_PX) {
      if (rowUsedWidth === 0) {
        rows++;
        rowUsedWidth = unitWidth;
      } else if (rowUsedWidth + WORD_GAP_PX + unitWidth <= REFERENCE_ROW_WIDTH_PX) {
        rowUsedWidth += WORD_GAP_PX + unitWidth;
      } else {
        rows++;
        rowUsedWidth = unitWidth;
      }
    } else {
      // Завелика одиниця ніколи не ділить рядок із сусідами (ні з
      // попередньою, ні з наступною) — закриває поточний рядок (якщо був)
      // і займає ЛИШЕ СВОЇ packIntoRows(...) рядки; наступна одиниця
      // відкриває новий рядок (rowUsedWidth = 0 нижче).
      const word = reconstructUnitWord(unit, hiddenLetters, gapOffset);
      const chunkWidths = sliceUnitByChunks(unit, splitIntoSyllableChunks(word)).map(cellsWidth);
      rows += packIntoRows(chunkWidths, REFERENCE_ROW_WIDTH_PX, 0);
      rowUsedWidth = 0;
    }
    gapOffset += unit.filter((c) => c === null).length;
  }
  return Math.max(1, rows);
}

// letter_rearrangement: плитки-літери без змістовних груп — звичайний
// збалансований перенос (chunkIntoRows, use-working-tile-layout.ts), k —
// скільки клітинок влазить у референсний рядок.
export function estimateLetterRearrangementCardRows(letterCount: number): number {
  const k = Math.max(1, Math.floor((REFERENCE_ROW_WIDTH_PX + FIXED_CELL_GAP_PX) / (FIXED_CELL_PX + FIXED_CELL_GAP_PX)));
  return Math.max(1, Math.ceil(letterCount / k));
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
