// Довжина тексту підказки word_search — без крайніх пробілів. Спільний
// примітив для сортування коротких пілюль (word-search.tsx, TextPill,
// ЕТАП F, варіант C) за зростанням довжини, щоб найкоротші природно йшли
// першими у flex-wrap рядку.
export function clueTextLength(text: string): number {
  return text.trim().length;
}

// Стабільне сортування за зростанням довжини тексту — Array.prototype.sort
// гарантовано стабільний (специфікація ES2019+), тож пілюлі однакової
// довжини лишаються у вхідному порядку (порядок зі списку слів).
export function sortByTextLength<T>(items: T[], getText: (item: T) => string): T[] {
  return [...items].sort((a, b) => clueTextLength(getText(a)) - clueTextLength(getText(b)));
}
