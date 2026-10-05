// Редагування блоків у конструкторі word_search/crossword (ЕТАП B/3) —
// чисті функції (без React), спільна точка входу для word-search-fields.tsx/
// crossword-fields.tsx через BlocksEditor.tsx. Джерело правди для членства
// слова в блоці — EditorWord.blockId (null = "Нерозподілені"); серіалізація
// (serializeBlocks) формує config.blocks у порядку блоків, wordKeys — у
// порядку слів у списку (ТОЙ САМИЙ принцип, що вже був у split-into-blocks.ts
// для мультимножини слів).
import type {
  WordSearchBlock,
  WordSearchWord,
  WordSearchPlacement,
  WordSearchConfig,
  CrosswordBlock,
  CrosswordWord,
  CrosswordPlacement,
  CrosswordConfig,
} from "./types";
import { normalizeWordSearchConfig, normalizeCrosswordConfig } from "./grid-blocks";
import { sanitizeWordForGrid } from "./grid-word";
import { generateBlockGrid } from "./generate-block-grid";
import { distributeWords, type DistributeMode } from "./build-blocks-config";
import type { BlockWarning } from "./split-into-blocks";
import { findIsolatedCrosswordWords } from "./task-validation";
import { WORD_SEARCH_MAX_GRID } from "./grid-limits";
import { BLOCK_MAX_COLS, BLOCK_MAX_ROWS, BLOCK_MAX_WORDS, BLOCK_MIN_WORDS } from "./grid-blocks";

export type ClueMode = "short" | "long" | "image";
type Kind = "word_search" | "crossword";

export type EditorWord<TWord> = TWord & { editorId: string; blockId: string | null };

export type WordSearchEditorGrid = { grid: string[][]; placements: WordSearchPlacement[]; gridSourceWords: string[] };
export type CrosswordEditorGrid = {
  placements: CrosswordPlacement[];
  gridWidth: number;
  gridHeight: number;
  gridSourceWords: string[];
};

export type EditorBlock<TGrid> = {
  id: string;
  title?: string;
  clueMode?: ClueMode;
  grid: TGrid | null;
};

export type EditorState<TWord, TGrid> = {
  words: EditorWord<TWord>[];
  blockOrder: string[];
  blocks: Record<string, EditorBlock<TGrid>>;
};

export type WordSearchEditorState = EditorState<WordSearchWord, WordSearchEditorGrid>;
export type CrosswordEditorState = EditorState<CrosswordWord, CrosswordEditorGrid>;

export type BlockDisplayWarning =
  | { type: "isolated-word"; word: string }
  | { type: "wide-block"; width: number; longestWord: string }
  | { type: "too-many-words"; count: number }
  | { type: "too-few-words"; count: number }
  | { type: "long-word"; word: string; length: number }
  | { type: "unplaced-word"; word: string };

export type DistributeResult<TWord, TGrid> = {
  state: EditorState<TWord, TGrid>;
  warnings: BlockWarning[];
  unplaced: string[];
  // Лише для mode "optimize" (ЕТАП C/3, build-blocks-config.ts) — статус
  // для UI ("Перебрано N варіантів, обрано найкращий (штраф X замість Y)").
  attempts?: number;
  score?: number;
  baseScore?: number;
};

function keyOf(word: string): string {
  return sanitizeWordForGrid(word).toUpperCase();
}

function stripEditorFields<TWord>(w: EditorWord<TWord>): TWord {
  const { editorId, blockId, ...rest } = w as unknown as Record<string, unknown>;
  void editorId;
  void blockId;
  return rest as TWord;
}

// Призначає кожному слову індекс ПЕРШОГО блоку (з переданого списку
// мультимножин wordKeys), чий пул ще містить ключ цього слова — той самий
// принцип, що selectWordsForBlock (grid-blocks.ts), лише одразу на КІЛЬКА
// блоків: кожен пул споживається незалежно, слово належить рівно одному
// блоку (чи жодному — null, "Нерозподілені").
function assignBlockIndices<TWord>(
  words: TWord[],
  wordKeyOf: (w: TWord) => string,
  blockWordKeysList: string[][]
): (number | null)[] {
  const remaining = blockWordKeysList.map((keys) => [...keys]);
  return words.map((w) => {
    const key = wordKeyOf(w);
    for (let bi = 0; bi < remaining.length; bi++) {
      const idx = remaining[bi].indexOf(key);
      if (idx !== -1) {
        remaining[bi].splice(idx, 1);
        return bi;
      }
    }
    return null;
  });
}

function wordSearchGridFrom(words: WordSearchWord[]): WordSearchEditorGrid {
  const r = generateBlockGrid("word_search", words);
  return { grid: r.grid, placements: r.placements, gridSourceWords: r.gridSourceWords };
}

function crosswordGridFrom(words: CrosswordWord[]): CrosswordEditorGrid {
  const r = generateBlockGrid("crossword", words);
  return { placements: r.placements, gridWidth: r.gridWidth, gridHeight: r.gridHeight, gridSourceWords: r.gridSourceWords };
}

function regenerateBlockGridInternal(
  blocks: Record<string, EditorBlock<unknown>>,
  blockId: string,
  words: EditorWord<unknown>[],
  kind: Kind
): Record<string, EditorBlock<unknown>> {
  const block = blocks[blockId];
  if (!block) return blocks;
  const blockWords = words.filter((w) => w.blockId === blockId).map(stripEditorFields);
  if (blockWords.length === 0) {
    return { ...blocks, [blockId]: { ...block, grid: null } };
  }
  const grid =
    kind === "word_search"
      ? wordSearchGridFrom(blockWords as WordSearchWord[])
      : crosswordGridFrom(blockWords as CrosswordWord[]);
  return { ...blocks, [blockId]: { ...block, grid } };
}

// ---- hydrate / serialize ----

export function hydrateEditorBlocks(config: WordSearchConfig, kind: "word_search"): WordSearchEditorState;
export function hydrateEditorBlocks(config: CrosswordConfig, kind: "crossword"): CrosswordEditorState;
export function hydrateEditorBlocks(
  config: WordSearchConfig | CrosswordConfig,
  kind: Kind
): EditorState<unknown, unknown> {
  const words = (config.words ?? []) as { word: string }[];

  type BlockDef = { wordKeys: string[]; title?: string; clueMode?: ClueMode; grid: unknown };
  let blockDefs: BlockDef[];
  if (kind === "word_search") {
    const norm = normalizeWordSearchConfig(config as WordSearchConfig);
    blockDefs = norm.blocks.map((b) => ({
      wordKeys: b.wordKeys,
      title: b.title,
      clueMode: b.clueMode,
      grid: { grid: b.grid, placements: b.placements, gridSourceWords: b.gridSourceWords ?? b.wordKeys } as WordSearchEditorGrid,
    }));
  } else {
    const norm = normalizeCrosswordConfig(config as CrosswordConfig);
    blockDefs = norm.blocks.map((b) => ({
      wordKeys: b.wordKeys,
      title: b.title,
      clueMode: b.clueMode,
      grid: {
        placements: b.placements,
        gridWidth: b.gridWidth,
        gridHeight: b.gridHeight,
        gridSourceWords: b.gridSourceWords ?? b.wordKeys,
      } as CrosswordEditorGrid,
    }));
  }

  const blockIds = blockDefs.map(() => crypto.randomUUID());
  const assigned = assignBlockIndices(words, (w) => keyOf(w.word), blockDefs.map((b) => b.wordKeys));
  const editorWords = words.map((w, i) => ({
    ...w,
    editorId: crypto.randomUUID(),
    blockId: assigned[i] === null ? null : blockIds[assigned[i] as number],
  }));

  const blocks: Record<string, EditorBlock<unknown>> = {};
  blockDefs.forEach((b, i) => {
    blocks[blockIds[i]] = { id: blockIds[i], title: b.title, clueMode: b.clueMode, grid: b.grid };
  });

  return { words: editorWords, blockOrder: blockIds, blocks };
}

export function serializeBlocks(state: WordSearchEditorState, kind: "word_search"): WordSearchBlock[];
export function serializeBlocks(state: CrosswordEditorState, kind: "crossword"): CrosswordBlock[];
export function serializeBlocks(state: EditorState<unknown, unknown>, kind: Kind): (WordSearchBlock | CrosswordBlock)[] {
  const result: (WordSearchBlock | CrosswordBlock)[] = [];
  for (const blockId of state.blockOrder) {
    const block = state.blocks[blockId];
    if (!block || !block.grid) continue;
    const wordsInBlock = state.words.filter((w) => w.blockId === blockId);
    if (wordsInBlock.length === 0) continue; // порожній блок відкидається при серіалізації
    const wordKeys = wordsInBlock.map((w) => keyOf((w as unknown as { word: string }).word));
    if (kind === "word_search") {
      const g = block.grid as WordSearchEditorGrid;
      result.push({
        wordKeys,
        grid: g.grid,
        placements: g.placements,
        gridSourceWords: g.gridSourceWords,
        title: block.title,
        clueMode: block.clueMode,
      });
    } else {
      const g = block.grid as CrosswordEditorGrid;
      result.push({
        wordKeys,
        placements: g.placements,
        gridWidth: g.gridWidth,
        gridHeight: g.gridHeight,
        gridSourceWords: g.gridSourceWords,
        title: block.title,
        clueMode: block.clueMode,
      });
    }
  }
  return result;
}

// ---- редагування ----

export function moveWordToBlock(
  state: WordSearchEditorState,
  kind: "word_search",
  wordEditorId: string,
  targetBlockId: string | null
): WordSearchEditorState;
export function moveWordToBlock(
  state: CrosswordEditorState,
  kind: "crossword",
  wordEditorId: string,
  targetBlockId: string | null
): CrosswordEditorState;
export function moveWordToBlock(
  state: EditorState<unknown, unknown>,
  kind: Kind,
  wordEditorId: string,
  targetBlockId: string | null
): EditorState<unknown, unknown> {
  const word = state.words.find((w) => w.editorId === wordEditorId);
  if (!word || word.blockId === targetBlockId) return state;
  const sourceBlockId = word.blockId;

  const words = state.words.map((w) => (w.editorId === wordEditorId ? { ...w, blockId: targetBlockId } : w));
  let blocks = state.blocks;
  for (const affectedId of [sourceBlockId, targetBlockId]) {
    if (affectedId && blocks[affectedId]) {
      blocks = regenerateBlockGridInternal(blocks, affectedId, words, kind);
    }
  }

  return { ...state, words, blocks };
}

export function createBlockWithWord(
  state: WordSearchEditorState,
  kind: "word_search",
  wordEditorId: string
): WordSearchEditorState;
export function createBlockWithWord(
  state: CrosswordEditorState,
  kind: "crossword",
  wordEditorId: string
): CrosswordEditorState;
export function createBlockWithWord(
  state: EditorState<unknown, unknown>,
  kind: Kind,
  wordEditorId: string
): EditorState<unknown, unknown> {
  const word = state.words.find((w) => w.editorId === wordEditorId);
  if (!word) return state;
  const sourceBlockId = word.blockId;
  const newBlockId = crypto.randomUUID();

  const words = state.words.map((w) => (w.editorId === wordEditorId ? { ...w, blockId: newBlockId } : w));
  let blocks: Record<string, EditorBlock<unknown>> = { ...state.blocks, [newBlockId]: { id: newBlockId, grid: null } };
  blocks = regenerateBlockGridInternal(blocks, newBlockId, words, kind);
  if (sourceBlockId && blocks[sourceBlockId]) blocks = regenerateBlockGridInternal(blocks, sourceBlockId, words, kind);

  return { ...state, words, blockOrder: [...state.blockOrder, newBlockId], blocks };
}

export function deleteBlock<TWord, TGrid>(
  state: EditorState<TWord, TGrid>,
  blockId: string,
  mode: "with-words" | "dissolve"
): EditorState<TWord, TGrid> {
  const words =
    mode === "dissolve"
      ? state.words.map((w) => (w.blockId === blockId ? { ...w, blockId: null } : w))
      : state.words.filter((w) => w.blockId !== blockId);
  const blocks = { ...state.blocks };
  delete blocks[blockId];
  return { ...state, words, blockOrder: state.blockOrder.filter((id) => id !== blockId), blocks };
}

export function moveBlock<TWord, TGrid>(
  state: EditorState<TWord, TGrid>,
  blockId: string,
  dir: "up" | "down"
): EditorState<TWord, TGrid> {
  const idx = state.blockOrder.indexOf(blockId);
  if (idx === -1) return state;
  const swapWith = dir === "up" ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= state.blockOrder.length) return state;
  const blockOrder = [...state.blockOrder];
  [blockOrder[idx], blockOrder[swapWith]] = [blockOrder[swapWith], blockOrder[idx]];
  return { ...state, blockOrder };
}

// Перегенерувати сітку ОДНОГО блоку з його ПОТОЧНИМ складом слів (кнопка
// "Перегенерувати блок") — не чіпає жоден інший блок.
export function regenerateBlock(
  state: WordSearchEditorState,
  kind: "word_search",
  blockId: string
): WordSearchEditorState;
export function regenerateBlock(
  state: CrosswordEditorState,
  kind: "crossword",
  blockId: string
): CrosswordEditorState;
export function regenerateBlock(
  state: EditorState<unknown, unknown>,
  kind: Kind,
  blockId: string
): EditorState<unknown, unknown> {
  if (!state.blocks[blockId]) return state;
  return { ...state, blocks: regenerateBlockGridInternal(state.blocks, blockId, state.words, kind) };
}

export function isBlockStale<TWord, TGrid extends { gridSourceWords: string[] } | null>(
  state: EditorState<TWord, TGrid>,
  blockId: string
): boolean {
  const block = state.blocks[blockId];
  if (!block) return false;
  if (!block.grid) return true;
  const current = state.words
    .filter((w) => w.blockId === blockId)
    .map((w) => keyOf((w as unknown as { word: string }).word))
    .sort();
  const generated = [...(block.grid as { gridSourceWords: string[] }).gridSourceWords].sort();
  return current.length !== generated.length || current.some((k, i) => k !== generated[i]);
}

// ---- авто-розподіл ----

function distribute(
  state: EditorState<unknown, unknown>,
  kind: Kind,
  mode: DistributeMode,
  opts?: { seed?: number }
): DistributeResult<unknown, unknown> {
  const unassigned = state.words.filter((w) => w.blockId === null);
  if (unassigned.length === 0) return { state, warnings: [], unplaced: [] };

  const plain = unassigned.map(stripEditorFields);
  const splitResult =
    kind === "word_search"
      ? distributeWords(plain as WordSearchWord[], "word_search", mode, opts)
      : distributeWords(plain as CrosswordWord[], "crossword", mode, opts);

  const newBlockIds = splitResult.blocks.map(() => crypto.randomUUID());
  const assigned = assignBlockIndices(
    unassigned,
    (w) => keyOf((w as unknown as { word: string }).word),
    splitResult.blocks.map((b) => b.wordKeys)
  );

  const words = state.words.map((w) => {
    if (w.blockId !== null) return w;
    const ui = unassigned.indexOf(w);
    const bi = assigned[ui];
    return bi === null ? w : { ...w, blockId: newBlockIds[bi] };
  });

  const blocks = { ...state.blocks };
  splitResult.blocks.forEach((b, i) => {
    const grid =
      kind === "word_search"
        ? ({
            grid: (b as WordSearchBlock).grid,
            placements: b.placements,
            gridSourceWords: b.gridSourceWords ?? b.wordKeys,
          } as WordSearchEditorGrid)
        : ({
            placements: b.placements,
            gridWidth: (b as CrosswordBlock).gridWidth,
            gridHeight: (b as CrosswordBlock).gridHeight,
            gridSourceWords: b.gridSourceWords ?? b.wordKeys,
          } as CrosswordEditorGrid);
    // title — заповнений лише у mode "category" (splitByCategory, "Noms",
    // "Noms (1/2)", "Інше"…); optimize/order лишають його undefined, як і
    // раніше (вчителька сама називає блок у BlocksEditor).
    blocks[newBlockIds[i]] = { id: newBlockIds[i], title: b.title, grid };
  });

  return {
    state: { ...state, words, blockOrder: [...state.blockOrder, ...newBlockIds], blocks },
    warnings: splitResult.warnings,
    unplaced: splitResult.unplaced,
    attempts: splitResult.attempts,
    score: splitResult.score,
    baseScore: splitResult.baseScore,
  };
}

export function autoDistributeUnassigned(
  state: WordSearchEditorState,
  kind: "word_search",
  mode?: DistributeMode,
  opts?: { seed?: number }
): DistributeResult<WordSearchWord, WordSearchEditorGrid>;
export function autoDistributeUnassigned(
  state: CrosswordEditorState,
  kind: "crossword",
  mode?: DistributeMode,
  opts?: { seed?: number }
): DistributeResult<CrosswordWord, CrosswordEditorGrid>;
export function autoDistributeUnassigned(
  state: EditorState<unknown, unknown>,
  kind: Kind,
  mode: DistributeMode = "optimize",
  opts?: { seed?: number }
): DistributeResult<unknown, unknown> {
  return distribute(state, kind, mode, opts);
}

// Скидає blockId УСІХ слів (назви/режими блоків втрачаються) і розподіляє
// все заново — поведінка старої кнопки "(Пере)генерувати" (до ЕТАПУ B).
export function resetAndDistributeAll(
  state: WordSearchEditorState,
  kind: "word_search",
  mode?: DistributeMode,
  opts?: { seed?: number }
): DistributeResult<WordSearchWord, WordSearchEditorGrid>;
export function resetAndDistributeAll(
  state: CrosswordEditorState,
  kind: "crossword",
  mode?: DistributeMode,
  opts?: { seed?: number }
): DistributeResult<CrosswordWord, CrosswordEditorGrid>;
export function resetAndDistributeAll(
  state: EditorState<unknown, unknown>,
  kind: Kind,
  mode: DistributeMode = "optimize",
  opts?: { seed?: number }
): DistributeResult<unknown, unknown> {
  const resetState: EditorState<unknown, unknown> = {
    words: state.words.map((w) => ({ ...w, blockId: null })),
    blockOrder: [],
    blocks: {},
  };
  return distribute(resetState, kind, mode, opts);
}

// ---- попередження для UI (не блокують, лише інформують) ----

export function computeBlockWarnings(
  kind: Kind,
  wordKeys: string[],
  grid: WordSearchEditorGrid | CrosswordEditorGrid | null
): BlockDisplayWarning[] {
  const warnings: BlockDisplayWarning[] = [];

  if (wordKeys.length > BLOCK_MAX_WORDS) warnings.push({ type: "too-many-words", count: wordKeys.length });
  if (wordKeys.length > 0 && wordKeys.length < BLOCK_MIN_WORDS) {
    warnings.push({ type: "too-few-words", count: wordKeys.length });
  }
  if (kind === "word_search") {
    wordKeys.forEach((k) => {
      if (k.length > WORD_SEARCH_MAX_GRID) warnings.push({ type: "long-word", word: k, length: k.length });
    });
  }

  if (!grid) return warnings;

  if (kind === "word_search") {
    const g = grid as WordSearchEditorGrid;
    const width = g.grid.length;
    if (width > BLOCK_MAX_COLS) {
      const longestWord = [...wordKeys].sort((a, c) => c.length - a.length)[0] ?? "";
      warnings.push({ type: "wide-block", width, longestWord });
    }
    const placedWords = new Set(g.placements.map((p) => p.word));
    wordKeys.forEach((k) => {
      if (!placedWords.has(k)) warnings.push({ type: "unplaced-word", word: k });
    });
  } else {
    const g = grid as CrosswordEditorGrid;
    if (g.gridWidth > BLOCK_MAX_COLS || g.gridHeight > BLOCK_MAX_ROWS) {
      const longestWord = [...wordKeys].sort((a, c) => c.length - a.length)[0] ?? "";
      warnings.push({ type: "wide-block", width: Math.max(g.gridWidth, g.gridHeight), longestWord });
    }
    findIsolatedCrosswordWords(g.placements).forEach((word) => warnings.push({ type: "isolated-word", word }));
  }

  return warnings;
}
