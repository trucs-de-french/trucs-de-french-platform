// Генерація сітки ОДНОГО блоку в конструкторі (ЕТАП B/3) — на відміну від
// splitWordsIntoBlocks (split-into-blocks.ts), тут немає автоподілу й
// немає жорстких лімітів: скільки слів передали — для стільки й будується
// сітка, ліміти (BLOCK_MAX_COLS/BLOCK_MAX_ROWS/BLOCK_MAX_WORDS/
// BLOCK_MIN_WORDS) застосовуються в block-editing.ts лише для попереджень,
// не для відмови чи повторного поділу. Crossword повторно використовує
// generateBestCrosswordAttempt (split-into-blocks.ts, relaxed=true) — та
// сама логіка вибору найкращої з CROSSWORD_BLOCK_ATTEMPTS спроб (із
// транспонуванням), не дублюється тут.
import type { WordSearchWord, CrosswordWord, WordSearchPlacement, CrosswordPlacement } from "./types";
import { generateWordSearchGrid } from "./word-search-grid";
import { generateCrosswordGrid } from "./crossword-grid";
import { generateBestCrosswordAttempt } from "./split-into-blocks";
import { BLOCK_WORD_SEARCH_DENSITY } from "./grid-blocks";

export type WordSearchBlockGridResult = {
  kind: "word_search";
  grid: string[][];
  placements: WordSearchPlacement[];
  gridSourceWords: string[];
  failedWords: string[];
  isolatedWords: string[]; // завжди [] — word_search не має поняття перетину
  gridWidth: number;
  gridHeight: number;
};

export type CrosswordBlockGridResult = {
  kind: "crossword";
  placements: CrosswordPlacement[];
  gridSourceWords: string[];
  failedWords: string[]; // завжди [] — кросворд ніколи не "не розміщує" слово, лише ізолює
  isolatedWords: string[];
  gridWidth: number;
  gridHeight: number;
};

export function generateBlockGrid(kind: "word_search", words: WordSearchWord[]): WordSearchBlockGridResult;
export function generateBlockGrid(kind: "crossword", words: CrosswordWord[]): CrosswordBlockGridResult;
export function generateBlockGrid(
  kind: "word_search" | "crossword",
  words: WordSearchWord[] | CrosswordWord[]
): WordSearchBlockGridResult | CrosswordBlockGridResult {
  if (kind === "word_search") {
    const result = generateWordSearchGrid(words as WordSearchWord[], BLOCK_WORD_SEARCH_DENSITY);
    return {
      kind: "word_search",
      grid: result.grid,
      placements: result.placements,
      gridSourceWords: result.sourceWords,
      failedWords: result.failedWords,
      isolatedWords: [],
      gridWidth: result.grid.length,
      gridHeight: result.grid.length,
    };
  }

  const crosswordWords = words as CrosswordWord[];
  const attempt = generateBestCrosswordAttempt(crosswordWords, generateCrosswordGrid, true);
  if (!attempt) {
    return {
      kind: "crossword",
      placements: [],
      gridSourceWords: [],
      failedWords: [],
      isolatedWords: crosswordWords.map((w) => w.word),
      gridWidth: 0,
      gridHeight: 0,
    };
  }
  return {
    kind: "crossword",
    placements: attempt.placements,
    gridSourceWords: attempt.sourceWords,
    failedWords: [],
    isolatedWords: attempt.isolatedWords,
    gridWidth: attempt.gridWidth,
    gridHeight: attempt.gridHeight,
  };
}
