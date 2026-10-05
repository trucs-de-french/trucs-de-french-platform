// Нормалізація word_search/crossword до структури блоків (WordSearchBlock/
// CrosswordBlock, types.ts) — ЄДИНА точка, де "старий формат" (плоский
// config.grid/placements/gridWidth/gridHeight, без config.blocks) стає
// списком з рівно ОДНОГО блоку. Чисті функції (без мутацій, ідемпотентні —
// config.blocks !== undefined повертає конфіг як є, без перерахунку) —
// викликаються з sanitize.ts/grade.ts/task-validation.ts і з адмінських
// полів (word-search-fields.tsx/crossword-fields.tsx, лише для читання
// initialConfig, без зміни UI). Реальний поділ слів на КІЛЬКА блоків —
// етап 2 (генератор блоків), тут його ще немає: для конфігу без blocks
// завжди виходить [] (сітку не згенеровано) або рівно один блок.
import type { CrosswordBlock, CrosswordConfig, WordSearchBlock, WordSearchConfig, WordSearchWord } from "./types";
import { sanitizeWordForGrid } from "./grid-word";

// Ліміти авто-поділу на блоки (split-into-blocks.ts) — одне місце,
// узгоджене з учителькою:
// - BLOCK_MAX_COLS=12 — 358px доступної ширини на мобільному / 28px на
//   клітинку (grid-cell-size.ts); ширина блоку релаксується понад це лише
//   для слова, яке й саме довше (max(BLOCK_MAX_COLS, найдовше слово
//   блоку)) — довге слово ніколи не "губиться", сітка просто прокручується
//   вбік.
// - BLOCK_MAX_ROWS=16 — висота НЕ релаксується (вертикальний скрол
//   нормальний, на відміну від горизонтального) — менш критичний ліміт.
// - BLOCK_MIN_WORDS/BLOCK_MAX_WORDS — бажаний розмір блоку; мінімум не
//   застосовується, якщо в ЦІЛІЙ вправі менше слів, ніж мінімум (тоді один
//   блок на все).
export const BLOCK_MAX_COLS = 12;
export const BLOCK_MAX_ROWS = 16;
export const BLOCK_MIN_WORDS = 3;
export const BLOCK_MAX_WORDS = 10;
// Кросворд — недетермінований генератор без власного ліміту розміру (на
// відміну від word_search, де розмір рахується формулою заздалегідь) —
// кілька спроб на кожен кандидат-набір слів, обирається найкраща з тих, що
// вклались у ліміти блоку (split-into-blocks.ts).
export const CROSSWORD_BLOCK_ATTEMPTS = 20;
// Крім оригінальної орієнтації кожної спроби, split-into-blocks.ts пробує і
// транспоновану (90°, transposeCrosswordPlacements у crossword-grid.ts) —
// кросворд часто виходить вузьким-і-високим або широким-і-низьким, тож
// один з двох варіантів регулярно вкладається в BLOCK_MAX_COLS, навіть
// коли інший ні. Вимкнути (false) — лишає лише оригінальну орієнтацію, як
// до етапу 4.
export const CROSSWORD_TRY_TRANSPOSE = true;
// Щільність (density, computeGridSize у word-search-grid.ts) лише для
// ПОДІЛУ НА БЛОКИ — менша за дефолтну (2.5) площа на літеру ⇒ щільніша
// сітка на ту саму кількість слів ⇒ більше слів влазить у BLOCK_MAX_COLS.
// Формула для звичайної (неблокової) генерації й код поза split-into-
// blocks.ts НЕ торкається — лишається 2.5. Підібрано вимірюванням (етап
// 4/4, measure.ts): на двох тестових словниках (20 і 30 слів, довжина
// 4-14 літер) 1.8 дає блоки по 8-10 слів (замість 5-8 при дефолтних 2.5),
// заповненість сітки до ~52% (мінімум сітки 10×10 у computeGridSize
// підстраховує від надто тісних сіток на малих блоках) — нижче умовного
// порогу ~60%.
export const BLOCK_WORD_SEARCH_DENSITY = 1.8;

// Розумний авто-розподіл (ЕТАП C/3, optimize-split.ts) — перебір кандидатів
// (перестановок списку слів перед звичайним splitWordsIntoBlocks), обирається
// найкращий за scoreSplit. Зупиняється, щойно настане ПЕРШЕ з двох: перебрано
// OPTIMIZE_MAX_ATTEMPTS кандидатів, або минуло OPTIMIZE_TIME_BUDGET_MS від
// старту (перевірка між кандидатами — можливий один зайвий виклик
// splitWordsIntoBlocks понад бюджет, не посередині нього).
export const OPTIMIZE_MAX_ATTEMPTS = 40;
export const OPTIMIZE_TIME_BUDGET_MS = 1500;

// Той самий ключ, що вже використовують placements/gradeWordSearch/
// gradeCrossword (sanitizeWordForGrid+upper) — НЕ сире w.word (легенда
// лишається оригіналом з апострофом/дефісом/пробілом у config.words).
function wordKeyOf(word: string): string {
  return sanitizeWordForGrid(word).toUpperCase();
}

export function normalizeWordSearchConfig(
  config: WordSearchConfig
): WordSearchConfig & { blocks: WordSearchBlock[] } {
  if (config.blocks !== undefined) {
    return config as WordSearchConfig & { blocks: WordSearchBlock[] };
  }

  const grid = config.grid ?? [];
  const placements = config.placements ?? [];
  // Сітку ще не згенеровано (нова вправа, адмінка ще не натиснула
  // "Згенерувати сітку") — blocks: [], а не вигаданий порожній блок (той
  // самий сенс, що раніше grid.length===0/placements.length===0 у
  // task-validation.ts).
  if (grid.length === 0 || placements.length === 0) {
    return { ...config, blocks: [] };
  }

  const words = config.words ?? [];
  const block: WordSearchBlock = {
    wordKeys: words.map((w) => wordKeyOf(w.word)),
    grid,
    placements,
    gridSourceWords: config.gridSourceWords,
  };
  return { ...config, blocks: [block] };
}

export function normalizeCrosswordConfig(
  config: CrosswordConfig
): CrosswordConfig & { blocks: CrosswordBlock[] } {
  if (config.blocks !== undefined) {
    return config as CrosswordConfig & { blocks: CrosswordBlock[] };
  }

  const placements = config.placements ?? [];
  const gridWidth = config.gridWidth ?? 0;
  const gridHeight = config.gridHeight ?? 0;
  // Той самий сенс, що word_search вище — "ще не згенеровано" = [], не
  // вигаданий блок (task-validation.ts: placements.length===0||gridWidth===0).
  if (placements.length === 0 || gridWidth === 0 || gridHeight === 0) {
    return { ...config, blocks: [] };
  }

  const words = config.words ?? [];
  const block: CrosswordBlock = {
    wordKeys: words.map((w) => wordKeyOf(w.word)),
    placements,
    gridWidth,
    gridHeight,
    gridSourceWords: config.gridSourceWords,
  };
  return { ...config, blocks: [block] };
}

// Повертає ТІ елементи words, що належать блоку з цим wordKeys — за
// порядком появи в words, по ОДНОМУ входженню на ключ (мультимножина, не
// Set): якщо вчителька ввела те саме слово двічі і обидва входження
// потрапили в один блок, wordKeys міститиме ключ двічі і обидва
// відповідні елементи words повернуться; якщо лише одне входження
// потрапило в цей блок (інше — в сусідній, можливо лише в майбутній
// реалізації етапу 2, що розкладає слова по різних блоках) — повертається
// рівно одне, те, що зустрічається раніше в words. Спільна для
// sanitizeWordSearch (словник блоку для студента) і gradeWordSearch
// (область слів ЦЬОГО блоку для перевірки).
export function selectWordsForBlock(words: WordSearchWord[], wordKeys: string[]): WordSearchWord[] {
  const remaining = [...wordKeys];
  const result: WordSearchWord[] = [];
  for (const w of words) {
    const idx = remaining.indexOf(wordKeyOf(w.word));
    if (idx === -1) continue;
    remaining.splice(idx, 1);
    result.push(w);
  }
  return result;
}
