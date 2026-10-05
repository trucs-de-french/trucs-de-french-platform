// Єдина точка, де реальні генератори (word-search-grid.ts/crossword-grid.ts)
// підключаються до авто-розподілу слів по блоках — спільна і для
// конструктора (block-editing.ts: "Розподілити автоматично"/"Скинути й
// розподілити всі заново"), і для масового створювача "Створити вправи зі
// словника" (bulk-from-vocab, tasks/actions.ts). Жодного React/DOM/
// "use client" — звичайний модуль, імпортовний і з серверного файлу
// ("use server"), і з клієнтських полів.
//
// ЕТАП C/3 — три способи розподілу (DistributeMode, optimize-split.ts):
// "order" — склад блоків рівно той, що й був до цього етапу
// (splitWordsIntoBlocks у ПОТОЧНОМУ порядку списку); "optimize" (типово) —
// розумний перебір перестановок (optimizeBlockSplit); "category" —
// групування за категорією слова зі скрипту (splitByCategory), з м'яким
// фолбеком на "optimize", якщо жодне слово категорії не має.
import { splitWordsIntoBlocks, type BlockWarning, type SplitBlocksResult } from "./split-into-blocks";
import { optimizeBlockSplit, splitByCategory, hasAnyCategory, type DistributeMode, type OptimizeOpts } from "./optimize-split";
import { generateWordSearchGrid } from "./word-search-grid";
import { generateCrosswordGrid } from "./crossword-grid";
import { BLOCK_WORD_SEARCH_DENSITY } from "./grid-blocks";
import type { WordSearchBlock, WordSearchWord, CrosswordBlock, CrosswordWord } from "./types";

export type { DistributeMode };

export type DistributeWordsResult<TBlock> = SplitBlocksResult<TBlock> & {
  // Лише для mode "optimize" (effectiveMode, після фолбеку) — скільки
  // кандидатів перебрано, яка оцінка обрана й була в першого кандидата
  // (поточний порядок), скільки часу пішло — для статусу в UI
  // (blocks-editor.tsx: "Перебрано N варіантів, обрано найкращий…").
  attempts?: number;
  score?: number;
  baseScore?: number;
  elapsedMs?: number;
};

export function distributeWords(
  words: WordSearchWord[],
  kind: "word_search",
  mode: DistributeMode,
  opts?: OptimizeOpts
): DistributeWordsResult<WordSearchBlock>;
export function distributeWords(
  words: CrosswordWord[],
  kind: "crossword",
  mode: DistributeMode,
  opts?: OptimizeOpts
): DistributeWordsResult<CrosswordBlock>;
export function distributeWords(
  words: WordSearchWord[] | CrosswordWord[],
  kind: "word_search" | "crossword",
  mode: DistributeMode,
  opts?: OptimizeOpts
): DistributeWordsResult<WordSearchBlock> | DistributeWordsResult<CrosswordBlock> {
  // "category" без жодної категоризованої вхідної лексики -> "optimize"
  // (той самий сенс, що неактивний пункт у select конструктора/радіо bulk-
  // from-vocab — тут це остання лінія захисту для прямих викликів).
  const effectiveMode: DistributeMode = mode === "category" && !hasAnyCategory(words) ? "optimize" : mode;

  if (kind === "word_search") {
    const wsWords = words as WordSearchWord[];
    const generate = (ws: WordSearchWord[]) => generateWordSearchGrid(ws, BLOCK_WORD_SEARCH_DENSITY);
    if (effectiveMode === "order") return splitWordsIntoBlocks(wsWords, "word_search", { generate });
    if (effectiveMode === "category") return splitByCategory(wsWords, "word_search", { generate });
    const r = optimizeBlockSplit(wsWords, "word_search", { generate }, opts);
    return { ...r.result, attempts: r.attempts, score: r.score, baseScore: r.baseScore, elapsedMs: r.elapsedMs };
  }

  const cwWords = words as CrosswordWord[];
  const generate = generateCrosswordGrid;
  if (effectiveMode === "order") return splitWordsIntoBlocks(cwWords, "crossword", { generate });
  if (effectiveMode === "category") return splitByCategory(cwWords, "crossword", { generate });
  const r = optimizeBlockSplit(cwWords, "crossword", { generate }, opts);
  return { ...r.result, attempts: r.attempts, score: r.score, baseScore: r.baseScore, elapsedMs: r.elapsedMs };
}

// Коротке людське повідомлення "увага" з попереджень поділу на блоки —
// для bulk-from-vocab (параметр warning, той самий механізм, що вже
// показує попередження на сторінці сцени) — конструктор сам показує
// попередження по блоках у картках (blocks-editor.tsx), там ця функція не
// потрібна.
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
