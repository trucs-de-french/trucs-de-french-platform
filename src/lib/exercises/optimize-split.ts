// Розумний авто-розподіл слів по блоках word_search/crossword (ЕТАП C/3) —
// без змін самого splitWordsIntoBlocks (контракт не торкаємо): цей модуль
// лише перебирає ПЕРЕСТАНОВКИ вхідного списку слів, кожну пропускає крізь
// splitWordsIntoBlocks як є, і обирає найкращу за scoreSplit. Чисті функції
// (без React, без генераторів усередині — deps.generate ззовні, той самий
// принцип, що split-into-blocks.ts).
import type {
  WordSearchBlock,
  WordSearchWord,
  CrosswordBlock,
  CrosswordWord,
} from "./types";
import {
  splitWordsIntoBlocks,
  type SplitBlocksResult,
  type BlockWarning,
  type WordSearchGenerateFn,
  type CrosswordGenerateFn,
} from "./split-into-blocks";
import { findIsolatedCrosswordWords } from "./task-validation";
import { sanitizeWordForGrid } from "./grid-word";
import {
  BLOCK_MAX_COLS,
  BLOCK_MAX_ROWS,
  BLOCK_MIN_WORDS,
  BLOCK_MAX_WORDS,
  OPTIMIZE_MAX_ATTEMPTS,
  OPTIMIZE_TIME_BUDGET_MS,
} from "./grid-blocks";

type Kind = "word_search" | "crossword";

export type DistributeMode = "optimize" | "order" | "category";

// mulberry32 — малий детермінований PRNG із 32-бітним seed (без нової
// залежності): той самий seed завжди дає ту саму послідовність — потрібно
// для відтворюваних скриптових тестів ("той самий seed -> той самий
// результат"); UI (blocks-editor.tsx) передає seed за замовчуванням
// Date.now(), тож повторний клік дає ІНШИЙ варіант.
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Fisher-Yates — не мутує вхідний масив.
export function shuffle<T>(items: T[], rng: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function keyLen(key: string): number {
  return key.length;
}

// "Широкий" блок — та сама поправка на найдовше слово блоку (max(
// BLOCK_MAX_COLS, найдовше)), що вже застосовується при самій генерації
// (widthLimitFor, split-into-blocks.ts) і в попередженнях (word-search-
// fields.tsx/task-validation.ts/block-editing.ts) — висота (BLOCK_MAX_ROWS)
// без поправки, той самий принцип, що там-таки ("не релаксується").
function isWideBlock(wordKeys: string[], width: number, height: number): boolean {
  const longest = Math.max(0, ...wordKeys.map(keyLen));
  const limit = Math.max(BLOCK_MAX_COLS, longest);
  return width > limit || height > BLOCK_MAX_ROWS;
}

function blockDims(block: WordSearchBlock | CrosswordBlock, kind: Kind): { width: number; height: number } {
  if (kind === "word_search") {
    const b = block as WordSearchBlock;
    return { width: b.grid.length, height: b.grid.length };
  }
  const b = block as CrosswordBlock;
  return { width: b.gridWidth, height: b.gridHeight };
}

// Оцінка поділу — МЕНШЕ краще, 0 = ідеально. Вага кожного доданка (з опису
// задачі):
//   нерозміщені слова         × 1000 — найгірше: слово зовсім зникло з вправи
//   блок поза 3..10 слів      ×  100 — порушує бажаний розмір блоку
//   блок ширший за екран      ×   60 — доведеться гортати вбік на телефоні
//   ізольоване слово кросворда ×  25 — працює, але без перетинів (гірший UX)
//   кожен додатковий блок     ×    5 — менше блоків = менше перемикань вкладок
//   нерівність (max-min слів) ×    2 — косметика, блоки приблизно однакового розміру
export function scoreSplit(
  result: SplitBlocksResult<WordSearchBlock> | SplitBlocksResult<CrosswordBlock>,
  kind: Kind
): number {
  const counts = result.blocks.map((b) => b.wordKeys.length);
  const outOfRange = counts.filter((c) => c < BLOCK_MIN_WORDS || c > BLOCK_MAX_WORDS).length;
  const wide = result.blocks.filter((b) => {
    const { width, height } = blockDims(b, kind);
    return isWideBlock(b.wordKeys, width, height);
  }).length;
  const isolated =
    kind === "crossword"
      ? (result.blocks as CrosswordBlock[]).reduce((sum, b) => sum + findIsolatedCrosswordWords(b.placements).length, 0)
      : 0;
  const imbalance = counts.length > 0 ? Math.max(...counts) - Math.min(...counts) : 0;

  return (
    result.unplaced.length * 1000 +
    outOfRange * 100 +
    wide * 60 +
    isolated * 25 +
    result.blocks.length * 5 +
    imbalance * 2
  );
}

export type OptimizeResult<TBlock> = {
  result: SplitBlocksResult<TBlock>;
  attempts: number;
  score: number;
  baseScore: number;
  elapsedMs: number;
};

export type OptimizeOpts = {
  seed?: number;
  maxAttempts?: number;
  timeBudgetMs?: number;
};

export function optimizeBlockSplit(
  words: WordSearchWord[],
  kind: "word_search",
  deps: { generate: WordSearchGenerateFn },
  opts?: OptimizeOpts
): OptimizeResult<WordSearchBlock>;
export function optimizeBlockSplit(
  words: CrosswordWord[],
  kind: "crossword",
  deps: { generate: CrosswordGenerateFn },
  opts?: OptimizeOpts
): OptimizeResult<CrosswordBlock>;
export function optimizeBlockSplit(
  words: WordSearchWord[] | CrosswordWord[],
  kind: Kind,
  deps: { generate: WordSearchGenerateFn | CrosswordGenerateFn },
  opts: OptimizeOpts = {}
): OptimizeResult<WordSearchBlock> | OptimizeResult<CrosswordBlock> {
  const seed = opts.seed ?? Date.now();
  const maxAttempts = opts.maxAttempts ?? OPTIMIZE_MAX_ATTEMPTS;
  const timeBudgetMs = opts.timeBudgetMs ?? OPTIMIZE_TIME_BUDGET_MS;
  const rng = mulberry32(seed);
  const start = Date.now();

  let best: SplitBlocksResult<WordSearchBlock> | SplitBlocksResult<CrosswordBlock> | undefined;
  let bestScore = Infinity;
  let baseScore = Infinity;
  let attempts = 0;
  // Перший кандидат — ПОТОЧНИЙ порядок (без перемішування): гарантує, що
  // optimize НІКОЛИ не гірший за "order" — це і є candidateWords=words на
  // attempts===1 нижче, лише пізніші спроби перемішуються.
  let candidateWords = words;

  for (attempts = 1; attempts <= maxAttempts; attempts++) {
    const result =
      kind === "word_search"
        ? splitWordsIntoBlocks(candidateWords as WordSearchWord[], "word_search", {
            generate: deps.generate as WordSearchGenerateFn,
          })
        : splitWordsIntoBlocks(candidateWords as CrosswordWord[], "crossword", {
            generate: deps.generate as CrosswordGenerateFn,
          });
    const score = scoreSplit(result, kind);
    if (attempts === 1) baseScore = score;
    if (score < bestScore) {
      bestScore = score;
      best = result;
    }
    if (bestScore === 0) break;
    if (Date.now() - start >= timeBudgetMs) break;
    if (attempts < maxAttempts) candidateWords = shuffle(words, rng);
  }

  return {
    result: best as never,
    attempts,
    score: bestScore,
    baseScore,
    elapsedMs: Date.now() - start,
  };
}

// ---- розподіл за категоріями ----

function normalizeCategoryKey(raw: string | undefined): string {
  return (raw ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

type CategoryGroup<TWord> = { key: string; label: string; words: TWord[] };

// Групи в порядку ПЕРШОЇ появи категорії у списку; слово без категорії
// (undefined/порожньо після trim) -> ключ "" ("Без категорії" нижче).
function groupByCategory<TWord extends { category?: string }>(words: TWord[]): CategoryGroup<TWord>[] {
  const order: string[] = [];
  const groups = new Map<string, CategoryGroup<TWord>>();
  for (const w of words) {
    const key = normalizeCategoryKey(w.category);
    let group = groups.get(key);
    if (!group) {
      group = { key, label: w.category?.trim() || "Без категорії", words: [] };
      groups.set(key, group);
      order.push(key);
    }
    group.words.push(w);
  }
  return order.map((k) => groups.get(k) as CategoryGroup<TWord>);
}

function withTitle<TBlock>(block: TBlock, title: string | undefined): TBlock {
  return title === undefined ? block : { ...block, title };
}

export function splitByCategory(
  words: WordSearchWord[],
  kind: "word_search",
  deps: { generate: WordSearchGenerateFn }
): SplitBlocksResult<WordSearchBlock>;
export function splitByCategory(
  words: CrosswordWord[],
  kind: "crossword",
  deps: { generate: CrosswordGenerateFn }
): SplitBlocksResult<CrosswordBlock>;
export function splitByCategory(
  words: (WordSearchWord | CrosswordWord)[],
  kind: Kind,
  deps: { generate: WordSearchGenerateFn | CrosswordGenerateFn }
): SplitBlocksResult<WordSearchBlock> | SplitBlocksResult<CrosswordBlock> {
  const groups = groupByCategory(words as { category?: string; word: string }[]);
  const warnings: BlockWarning[] = [];
  const unplaced: string[] = [];
  const blocks: (WordSearchBlock | CrosswordBlock)[] = [];

  const bigGroups = groups.filter((g) => g.words.length >= BLOCK_MIN_WORDS);
  // "Інше" — "Без категорії" + усі категорії, яким не вистачило слів на
  // власний блок (merge ПЕРЕД розподілом, не окремими дрібними блоками).
  const otherWords = groups.filter((g) => g.words.length < BLOCK_MIN_WORDS).flatMap((g) => g.words);

  function runSplit(groupWords: (WordSearchWord | CrosswordWord)[]): SplitBlocksResult<WordSearchBlock | CrosswordBlock> {
    return kind === "word_search"
      ? splitWordsIntoBlocks(groupWords as WordSearchWord[], "word_search", { generate: deps.generate as WordSearchGenerateFn })
      : splitWordsIntoBlocks(groupWords as CrosswordWord[], "crossword", { generate: deps.generate as CrosswordGenerateFn });
  }

  for (const group of bigGroups) {
    const res = runSplit(group.words);
    res.blocks.forEach((b, i) => {
      const title = res.blocks.length > 1 ? `${group.label} (${i + 1}/${res.blocks.length})` : group.label;
      blocks.push(withTitle(b, title));
    });
    warnings.push(...res.warnings);
    unplaced.push(...res.unplaced);
  }

  if (otherWords.length > 0) {
    if (otherWords.length < BLOCK_MIN_WORDS && blocks.length > 0) {
      // Замало для власного блоку, і вже є куди долити — об'єднуємо з
      // НАЙМЕНШИМ наявним блоком (за кількістю слів) і перегенеровуємо
      // лише його (склад змінився), з попередженням merged-small-block.
      let smallestIndex = 0;
      for (let i = 1; i < blocks.length; i++) {
        if (blocks[i].wordKeys.length < blocks[smallestIndex].wordKeys.length) smallestIndex = i;
      }
      const smallestTitle = blocks[smallestIndex].title;
      const mergedWords = [
        ...(otherWords as (WordSearchWord | CrosswordWord)[]),
      ];
      // Слова найменшого блоку відновлюємо з вхідного списку за ключами
      // (мультимножина, як selectWordsForBlock) — той самий порядок появи.
      const smallestKeys = [...blocks[smallestIndex].wordKeys];
      const remaining = [...smallestKeys];
      const smallestWords = (words as (WordSearchWord | CrosswordWord)[]).filter((w) => {
        const idx = remaining.indexOf(normalizeWordKeyFor(w));
        if (idx === -1) return false;
        remaining.splice(idx, 1);
        return true;
      });
      mergedWords.push(...smallestWords);
      const res = runSplit(mergedWords);
      res.blocks.forEach((b) => blocks.push(withTitle(b, smallestTitle)));
      blocks.splice(smallestIndex, 1);
      warnings.push({ type: "merged-small-block", blockIndex: blocks.length - 1 });
      warnings.push(...res.warnings);
      unplaced.push(...res.unplaced);
    } else {
      const res = runSplit(otherWords);
      res.blocks.forEach((b, i) => {
        const title = res.blocks.length > 1 ? `Інше (${i + 1}/${res.blocks.length})` : "Інше";
        blocks.push(withTitle(b, title));
      });
      warnings.push(...res.warnings);
      unplaced.push(...res.unplaced);
    }
  }

  return { blocks, warnings, unplaced } as
    | SplitBlocksResult<WordSearchBlock>
    | SplitBlocksResult<CrosswordBlock>;
}

// Той самий ключ, що wordKeys/placements (sanitizeWordForGrid+upper) — для
// відновлення слів найменшого блоку за його wordKeys вище.
function normalizeWordKeyFor(w: { word: string }): string {
  return sanitizeWordForGrid(w.word).toUpperCase();
}

// Чи має хоч одне слово непорожню категорію — режим "category" доступний
// лише тоді (інакше UI показує пункт неактивним / distributeWords сам
// фолбекає на "optimize", build-blocks-config.ts).
export function hasAnyCategory(words: { category?: string }[]): boolean {
  return words.some((w) => normalizeCategoryKey(w.category) !== "");
}

// Скільки РІЗНИХ іменованих категорій (для підпису "За категоріями (N)" в
// UI) — "Без категорії" НЕ рахується (це не категорія зі скрипту, а
// позначення її відсутності).
export function countCategories(words: { category?: string }[]): number {
  return new Set(words.map((w) => normalizeCategoryKey(w.category)).filter((k) => k !== "")).size;
}
