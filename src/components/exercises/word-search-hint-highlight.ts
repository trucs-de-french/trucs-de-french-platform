// Похідний (не власний React-стан) набір клітинок філворду, які мають бути
// синьо підсвічені як "відкрита підказкою перша літера" (word-search.tsx,
// заміна блимання). Клітинка в наборі ⟺ існує слово з hintStart, що вже
// підказане (hintedWords), але ще НЕ знайдене (foundWords) — слова без
// hintStart (null/undefined, підказки для них узагалі неможливі) просто
// пропускаються, без помилки.
//
// Якщо та сама клітинка — hintStart одразу кількох слів: вона синя, якщо
// хоч ОДНЕ з них підпадає під умову вище (підказане й не знайдене) —
// знайденість/непідказаність ОДНОГО слова не гасить синій, поки лишається
// хоч одне інше слово, якому ця клітинка ще потрібна як підказка.
//
// Зелена пілюля знайденого слова (SVG-оверлей у word-search.tsx) малюється
// в DOM ПІСЛЯ сітки літер, тож вона завжди візуально поверх синього фону
// клітинки — окремої логіки "зелене має пріоритет" тут не потрібно, це
// наслідок порядку малювання, не цієї функції.
export type HintHighlightWord = {
  word: string;
  hintStart?: { row: number; col: number } | null;
};

export function hintHighlightCells(
  words: HintHighlightWord[],
  hintedWords: Set<string>,
  foundWords: Set<string>
): Set<string> {
  const cells = new Set<string>();
  for (const w of words) {
    if (!w.hintStart) continue;
    if (!hintedWords.has(w.word)) continue;
    if (foundWords.has(w.word)) continue;
    cells.add(`${w.hintStart.row}:${w.hintStart.col}`);
  }
  return cells;
}
