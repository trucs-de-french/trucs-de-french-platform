// Межі розміру для word_search/crossword — одне місце для генераторів,
// адмінських попереджень (word-search-fields.tsx/crossword-fields.tsx) і
// масового створювача зі словника (bulk-from-vocab, tasks/actions.ts).
//
// WORD_SEARCH_MAX_GRID — сторона сітки (клітинок), не кількість слів:
// генератор (word-search-grid.ts) фізично не будує сітку більшу за це,
// незалежно від кількості/довжини слів — усе, що не вміщається, повертається
// як failedWords, а не розсуває сітку далі. Для crossword аналогічного
// "розміру сітки" немає — форма органічна (bounding box слів, не
// попередньо задана сітка), тому обмежуємо лише кількість слів на вході
// (CROSSWORD_MAX_WORDS): природно тримає результат у розумних межах, не
// чіпаючи саму (ретельно налаштовану) логіку розміщення.
export const WORD_SEARCH_MAX_WORDS = 12;
export const WORD_SEARCH_MAX_GRID = 15;
export const CROSSWORD_MAX_WORDS = 15;

// Рівномірний поділ на частини, коли слів більше за максимум для одного
// filworda/кросворда (bulk-from-vocab: 20 слів, максимум 12 -> 2 вправи по
// 10, а не 12+8) — chunkSize рахується від КІЛЬКОСТІ частин, не від самого
// maxPerChunk, щоб останній шматок не був суттєво менший за решту.
export function splitIntoChunks<T>(items: T[], maxPerChunk: number): T[][] {
  if (items.length <= maxPerChunk) return [items];
  const numParts = Math.ceil(items.length / maxPerChunk);
  const chunkSize = Math.ceil(items.length / numParts);
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}
