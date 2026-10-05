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
