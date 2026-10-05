// Єдина точка, де реальні генератори (word-search-grid.ts/crossword-grid.ts)
// підключаються до split-into-blocks.ts (чистого, без генераторів усередині,
// — тестованість скриптом поза адмінкою) — спільна і для адмінки
// ((Пере)генерувати, word-search-fields.tsx/crossword-fields.tsx), і для
// масового створювача "Створити вправи зі словника" (bulk-from-vocab,
// tasks/actions.ts). Жодного React/DOM/"use client" — звичайний модуль,
// імпортовний і з серверного файлу ("use server"), і з клієнтських полів.
import { splitWordsIntoBlocks, type BlockWarning, type SplitBlocksResult } from "./split-into-blocks";
import { generateWordSearchGrid } from "./word-search-grid";
import { generateCrosswordGrid } from "./crossword-grid";
import { BLOCK_WORD_SEARCH_DENSITY } from "./grid-blocks";
import type { WordSearchBlock, WordSearchWord, CrosswordBlock, CrosswordWord } from "./types";

export function buildWordSearchBlocksConfig(words: WordSearchWord[]): SplitBlocksResult<WordSearchBlock> {
  return splitWordsIntoBlocks(words, "word_search", {
    generate: (blockWords) => generateWordSearchGrid(blockWords, BLOCK_WORD_SEARCH_DENSITY),
  });
}

export function buildCrosswordBlocksConfig(words: CrosswordWord[]): SplitBlocksResult<CrosswordBlock> {
  return splitWordsIntoBlocks(words, "crossword", { generate: generateCrosswordGrid });
}

// Коротке людське повідомлення "увага" з попереджень поділу на блоки —
// для bulk-from-vocab (параметр warning, той самий механізм, що вже
// показує попередження на сторінці сцени) — конструктор сам показує
// попередження по блоках у картках (word-search-fields.tsx/crossword-
// fields.tsx), там ця функція не потрібна.
export function formatBlockWarnings(warnings: BlockWarning[]): string[] {
  return warnings.map((w) => {
    switch (w.type) {
      case "isolated-word":
        return `слово «${w.word}» не перетнулось з іншими (блок ${w.blockIndex + 1})`;
      case "wide-block":
        return `блок ${w.blockIndex + 1} ширший за екран телефона через слово «${w.longestWord}»`;
      case "merged-small-block":
        return `блок ${w.blockIndex + 1} об'єднано з попереднім (замало слів для окремого)`;
      case "long-word":
        return `слово «${w.word}» (${w.length} літер) занадто довге — не розміщено`;
    }
  });
}
