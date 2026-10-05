// Автоматичний поділ списку слів word_search/crossword на кілька менших
// блоків (кожен — своя сітка) — викликається ОДИН РАЗ в адмінці, на клік
// "(Пере)генерувати" (word-search-fields.tsx/crossword-fields.tsx, етап
// 2/4), результат зберігається в config.blocks (types.ts/grid-blocks.ts),
// студент НІКОЛИ не перегенеровує. Чиста функція (без React) — генератори
// передаються ззовні (deps.generate) для тестованості скриптом поза
// адмінкою.
//
// Слова беруться ПО ПОРЯДКУ зі списку вчительки — єдиний важіль впливу на
// склад блоків (жодного семантичного групування, лише жадібне заповнення
// "поки влазить"). Довжина слова для перевірки лімітів — ПІСЛЯ
// sanitizeWordForGrid (grid-word.ts): "une ingratitude" важить як 14
// літер-клітинок, не 16 символів разом з пробілом.
import type {
  CrosswordBlock,
  CrosswordPlacement,
  CrosswordWord,
  WordSearchBlock,
  WordSearchPlacement,
  WordSearchWord,
} from "./types";
import { sanitizeWordForGrid } from "./grid-word";
import { computeGridSize } from "./word-search-grid";
import { transposeCrosswordPlacements } from "./crossword-grid";
import { WORD_SEARCH_MAX_GRID } from "./grid-limits";
import {
  BLOCK_MAX_COLS,
  BLOCK_MAX_ROWS,
  BLOCK_MAX_WORDS,
  BLOCK_MIN_WORDS,
  BLOCK_WORD_SEARCH_DENSITY,
  CROSSWORD_BLOCK_ATTEMPTS,
  CROSSWORD_TRY_TRANSPOSE,
} from "./grid-blocks";

export type BlockWarning =
  | { type: "isolated-word"; word: string; blockIndex: number }
  | { type: "wide-block"; blockIndex: number; width: number; longestWord: string }
  | { type: "merged-small-block"; blockIndex: number }
  | { type: "long-word"; word: string; length: number };

export type SplitBlocksResult<TBlock> = {
  blocks: TBlock[];
  warnings: BlockWarning[];
  unplaced: string[];
};

function keyOf(word: string): string {
  return sanitizeWordForGrid(word).toUpperCase();
}

function widthLimitFor(keys: string[]): number {
  const longest = Math.max(0, ...keys.map((k) => k.length));
  return Math.max(BLOCK_MAX_COLS, longest);
}

// ---- word_search ----

export type WordSearchGenerateFn = (words: WordSearchWord[]) => {
  grid: string[][];
  placements: WordSearchPlacement[];
  failedWords: string[];
  sourceWords: string[];
};

function buildWordSearchBlock(
  blockWords: WordSearchWord[],
  result: ReturnType<WordSearchGenerateFn>
): WordSearchBlock {
  return {
    wordKeys: blockWords.map((w) => keyOf(w.word)),
    grid: result.grid,
    placements: result.placements,
    gridSourceWords: result.sourceWords,
  };
}

// Жадібний прохід — для кожного кандидата (поточний блок + наступне слово)
// лише ДЕТЕРМІНОВАНА формула розміру (computeGridSize, без генерації) —
// генерація (дорога, випадкова) відбувається лише після того, як склад
// блоку вже зафіксовано нижче.
function splitWordSearchCandidates(words: WordSearchWord[]): {
  candidates: WordSearchWord[][];
  unplaced: string[];
  warnings: BlockWarning[];
} {
  const warnings: BlockWarning[] = [];
  const unplaced: string[] = [];
  const candidates: WordSearchWord[][] = [];
  let candidate: WordSearchWord[] = [];

  for (const w of words) {
    const key = keyOf(w.word);
    if (!key) continue;
    if (key.length > WORD_SEARCH_MAX_GRID) {
      unplaced.push(w.word);
      warnings.push({ type: "long-word", word: w.word, length: key.length });
      continue;
    }

    const trial = [...candidate, w];
    const trialKeys = trial.map((x) => keyOf(x.word));
    const limit = widthLimitFor(trialKeys);
    const size = computeGridSize(trialKeys, BLOCK_WORD_SEARCH_DENSITY);

    if (trial.length <= BLOCK_MAX_WORDS && size <= limit) {
      candidate = trial;
    } else {
      if (candidate.length > 0) candidates.push(candidate);
      candidate = [w];
    }
  }
  if (candidate.length > 0) candidates.push(candidate);

  // Останній неповний блок добирає слова з кінця попереднього; якщо
  // попередній став би менший за мінімум — зливаємо в один (дозволено
  // перевищити ліміти, з попередженням нижче, не тут — межі блоку в
  // підсумку можуть вийти за BLOCK_MAX_COLS/BLOCK_MAX_WORDS).
  if (candidates.length > 1) {
    const last = candidates[candidates.length - 1];
    if (last.length < BLOCK_MIN_WORDS) {
      const prev = candidates[candidates.length - 2];
      const needed = BLOCK_MIN_WORDS - last.length;
      if (prev.length - needed >= BLOCK_MIN_WORDS) {
        const pulled = prev.splice(prev.length - needed, needed);
        last.unshift(...pulled);
      } else {
        const merged = [...prev, ...last];
        candidates.splice(candidates.length - 2, 2, merged);
        warnings.push({ type: "merged-small-block", blockIndex: candidates.length - 1 });
      }
    }
  }

  return { candidates, unplaced, warnings };
}

function splitWordSearchIntoBlocks(
  words: WordSearchWord[],
  generate: WordSearchGenerateFn
): SplitBlocksResult<WordSearchBlock> {
  const { candidates, unplaced, warnings } = splitWordSearchCandidates(words);
  const blocks: WordSearchBlock[] = [];
  let overflow: WordSearchWord[] = [];

  for (const candidate of candidates) {
    const blockWords = [...overflow, ...candidate];
    overflow = [];
    const result = generate(blockWords);

    if (result.failedWords.length === 0) {
      blocks.push(buildWordSearchBlock(blockWords, result));
      continue;
    }

    const failedKeys = new Set(result.failedWords);
    const keep = blockWords.filter((w) => !failedKeys.has(keyOf(w.word)));
    const failed = blockWords.filter((w) => failedKeys.has(keyOf(w.word)));

    if (keep.length === 0) {
      // Увесь блок складався з невдалих слів (на практиці майже неможливо —
      // кожне окреме слово вже пройшло перевірку розміру вище) — лишаються
      // нерозміщеними, без власного блоку.
      failed.forEach((w) => unplaced.push(w.word));
      continue;
    }

    const regen = generate(keep);
    blocks.push(buildWordSearchBlock(keep, regen));
    // Невдалі слова пробують ще раз у НАСТУПНОМУ блоці — той самий принцип,
    // що жадібний прохід вище.
    overflow = failed;
    regen.failedWords.forEach((k) => unplaced.push(k));
  }

  if (overflow.length > 0) {
    const result = generate(overflow);
    if (result.failedWords.length === overflow.length) {
      overflow.forEach((w) => unplaced.push(w.word));
    } else {
      const failedKeys = new Set(result.failedWords);
      const keep = overflow.filter((w) => !failedKeys.has(keyOf(w.word)));
      blocks.push(buildWordSearchBlock(keep, generate(keep)));
      result.failedWords.forEach((k) => unplaced.push(k));
    }
  }

  blocks.forEach((b, i) => {
    if (b.grid.length > BLOCK_MAX_COLS) {
      const longestWord = [...b.wordKeys].sort((a, c) => c.length - a.length)[0] ?? "";
      warnings.push({ type: "wide-block", blockIndex: i, width: b.grid.length, longestWord });
    }
  });

  return { blocks, warnings, unplaced };
}

// ---- crossword ----

export type CrosswordGenerateFn = (words: CrosswordWord[]) => {
  placements: CrosswordPlacement[];
  gridWidth: number;
  gridHeight: number;
  isolatedWords: string[];
  sourceWords: string[];
};

type CrosswordAttempt = ReturnType<CrosswordGenerateFn>;

function pickBestCrosswordAttempt(attempts: CrosswordAttempt[]): CrosswordAttempt | undefined {
  if (attempts.length === 0) return undefined;
  return attempts.reduce((best, cur) => {
    if (cur.isolatedWords.length !== best.isolatedWords.length) {
      return cur.isolatedWords.length < best.isolatedWords.length ? cur : best;
    }
    const bestArea = best.gridWidth * best.gridHeight;
    const curArea = cur.gridWidth * cur.gridHeight;
    return curArea < bestArea ? cur : best;
  });
}

// До CROSSWORD_BLOCK_ATTEMPTS спроб — рахуємо лише ті, що вклались у
// ліміти блоку (width<=limit, height<=BLOCK_MAX_ROWS), завершуємо раніше,
// якщо знайшлась спроба без жодного ізольованого слова. relaxed=true
// (злиття малого останнього блоку) ігнорує ліміти — підходить будь-яка
// спроба, обирається найкраща з усіх.
// Експортовано для generate-block-grid.ts (ЕТАП B/3) — конструктор
// перегенеровує сітку ОДНОГО блоку (без автоподілу) тим самим алгоритмом
// вибору найкращої спроби з транспонуванням, relaxed=true, щоб не
// дублювати цю логіку.
export function generateBestCrosswordAttempt(
  words: CrosswordWord[],
  generate: CrosswordGenerateFn,
  relaxed = false
): CrosswordAttempt | undefined {
  const keys = words.map((w) => keyOf(w.word));
  const limit = widthLimitFor(keys);
  const fitting: CrosswordAttempt[] = [];
  const all: CrosswordAttempt[] = [];

  function consider(result: CrosswordAttempt): boolean {
    all.push(result);
    if (result.gridWidth <= limit && result.gridHeight <= BLOCK_MAX_ROWS) {
      fitting.push(result);
      if (result.isolatedWords.length === 0) return true;
    }
    return false;
  }

  for (let attempt = 0; attempt < CROSSWORD_BLOCK_ATTEMPTS; attempt++) {
    const result = generate(words);
    if (consider(result)) break;
    // Та сама спроба, повернута на 90° (row<->col, across<->down,
    // перенумерована) — кросворд часто виходить вузьким-і-високим або
    // навпаки, тож одна з двох орієнтацій регулярно вкладається в
    // BLOCK_MAX_COLS, навіть коли інша ні. isolatedWords/sourceWords не
    // залежать від орієнтації — копіюються як є.
    if (CROSSWORD_TRY_TRANSPOSE) {
      const transposed: CrosswordAttempt = {
        placements: transposeCrosswordPlacements(result.placements),
        gridWidth: result.gridHeight,
        gridHeight: result.gridWidth,
        isolatedWords: result.isolatedWords,
        sourceWords: result.sourceWords,
      };
      if (consider(transposed)) break;
    }
  }

  if (fitting.length > 0) return pickBestCrosswordAttempt(fitting);
  return relaxed ? pickBestCrosswordAttempt(all) : undefined;
}

function buildCrosswordBlock(blockWords: CrosswordWord[], result: CrosswordAttempt): CrosswordBlock {
  return {
    wordKeys: blockWords.map((w) => keyOf(w.word)),
    placements: result.placements,
    gridWidth: result.gridWidth,
    gridHeight: result.gridHeight,
    gridSourceWords: result.sourceWords,
  };
}

function splitCrosswordIntoBlocks(
  words: CrosswordWord[],
  generate: CrosswordGenerateFn
): SplitBlocksResult<CrosswordBlock> {
  const warnings: BlockWarning[] = [];
  const unplaced: string[] = [];

  type Pending = { words: CrosswordWord[]; result: CrosswordAttempt };
  const pending: Pending[] = [];
  let candidate: CrosswordWord[] = [];
  let candidateResult: CrosswordAttempt | undefined;

  for (const w of words) {
    if (!keyOf(w.word)) continue;
    const trial = [...candidate, w];
    const trialResult = trial.length <= BLOCK_MAX_WORDS ? generateBestCrosswordAttempt(trial, generate) : undefined;

    if (trialResult) {
      candidate = trial;
      candidateResult = trialResult;
    } else {
      // Жодна спроба не вклалась для РОЗШИРЕНОГО набору — попередній
      // зафіксований стан (уже згенерована сітка) стає блоком, нове слово
      // відкриває наступний.
      if (candidate.length > 0 && candidateResult) {
        pending.push({ words: candidate, result: candidateResult });
      }
      candidate = [w];
      candidateResult = generateBestCrosswordAttempt(candidate, generate, true);
    }
  }
  if (candidate.length > 0 && candidateResult) {
    pending.push({ words: candidate, result: candidateResult });
  }

  // Останній неповний блок — та сама логіка, що word_search, лише з
  // перегенерацією зачеплених блоків (склад слів змінився).
  if (pending.length > 1) {
    const last = pending[pending.length - 1];
    if (last.words.length < BLOCK_MIN_WORDS) {
      const prev = pending[pending.length - 2];
      const needed = BLOCK_MIN_WORDS - last.words.length;
      if (prev.words.length - needed >= BLOCK_MIN_WORDS) {
        const pulled = prev.words.splice(prev.words.length - needed, needed);
        last.words.unshift(...pulled);
        const prevResult = generateBestCrosswordAttempt(prev.words, generate, true);
        const lastResult = generateBestCrosswordAttempt(last.words, generate, true);
        if (prevResult) prev.result = prevResult;
        if (lastResult) last.result = lastResult;
      } else {
        const mergedWords = [...prev.words, ...last.words];
        const mergedResult = generateBestCrosswordAttempt(mergedWords, generate, true);
        if (mergedResult) {
          pending.splice(pending.length - 2, 2, { words: mergedWords, result: mergedResult });
          warnings.push({ type: "merged-small-block", blockIndex: pending.length - 1 });
        }
      }
    }
  }

  const blocks: CrosswordBlock[] = pending.map((p) => buildCrosswordBlock(p.words, p.result));

  blocks.forEach((b, i) => {
    if (b.gridWidth > BLOCK_MAX_COLS || b.gridHeight > BLOCK_MAX_ROWS) {
      const longestWord = [...b.wordKeys].sort((a, c) => c.length - a.length)[0] ?? "";
      warnings.push({ type: "wide-block", blockIndex: i, width: Math.max(b.gridWidth, b.gridHeight), longestWord });
    }
    pending[i].result.isolatedWords.forEach((word) => {
      warnings.push({ type: "isolated-word", word, blockIndex: i });
    });
  });

  return { blocks, warnings, unplaced };
}

// ---- спільна точка входу ----

export function splitWordsIntoBlocks(
  words: WordSearchWord[],
  kind: "word_search",
  deps?: { generate?: WordSearchGenerateFn }
): SplitBlocksResult<WordSearchBlock>;
export function splitWordsIntoBlocks(
  words: CrosswordWord[],
  kind: "crossword",
  deps?: { generate?: CrosswordGenerateFn }
): SplitBlocksResult<CrosswordBlock>;
export function splitWordsIntoBlocks(
  words: WordSearchWord[] | CrosswordWord[],
  kind: "word_search" | "crossword",
  deps?: { generate?: WordSearchGenerateFn | CrosswordGenerateFn }
): SplitBlocksResult<WordSearchBlock> | SplitBlocksResult<CrosswordBlock> {
  if (kind === "word_search") {
    return splitWordSearchIntoBlocks(
      words as WordSearchWord[],
      (deps?.generate as WordSearchGenerateFn | undefined) ?? requireGenerate("word_search")
    );
  }
  return splitCrosswordIntoBlocks(
    words as CrosswordWord[],
    (deps?.generate as CrosswordGenerateFn | undefined) ?? requireGenerate("crossword")
  );
}

// Реальні генератори НЕ імпортуються напряму зверху файлу (лише типи) —
// уникає залежності цього чистого модуля від word-search-grid.ts/
// crossword-grid.ts для тестів (скриптова перевірка підставляє власний
// deps.generate); адмінка (word-search-fields.tsx/crossword-fields.tsx)
// завжди передає deps.generate явно, тож ця гілка там не виконується.
function requireGenerate(kind: "word_search" | "crossword"): never {
  throw new Error(`splitWordsIntoBlocks(${kind}): deps.generate обов'язковий`);
}
