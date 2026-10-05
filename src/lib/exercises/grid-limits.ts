// Межі розміру для word_search/crossword — одне місце для генераторів і
// адмінських попереджень (word-search-fields.tsx/crossword-fields.tsx).
//
// WORD_SEARCH_MAX_GRID — сторона сітки (клітинок), не кількість слів:
// генератор (word-search-grid.ts) фізично не будує сітку більшу за це,
// незалежно від кількості/довжини слів — усе, що не вміщається, повертається
// як failedWords, а не розсуває сітку далі.
//
// Кількість слів на одну вправу (раніше WORD_SEARCH_MAX_WORDS/
// CROSSWORD_MAX_WORDS/splitIntoChunks, що ділили словник на кілька окремих
// вправ-"частин") тепер НЕ обмежена тут — етап "bulk-from-vocab на блоки"
// (build-blocks-config.ts) робить одну вправу з config.blocks (кожен блок —
// своя менша сітка, splitWordsIntoBlocks у split-into-blocks.ts), без
// верхньої межі кількості слів (лише м'яке попередження в
// bulkCreateTasksFromVocab при >60).
export const WORD_SEARCH_MAX_GRID = 15;
