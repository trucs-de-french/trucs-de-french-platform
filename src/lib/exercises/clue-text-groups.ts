// Групування плиток-підказок word_search за довжиною тексту — щоб плитки в
// одному ряду мали візуально близький розмір (без цього довге слово
// розтягувало колонку, а короткі лишались у пустих клітинках поруч). Чисті
// функції (без React) — для двох РІЗНИХ сценаріїв:
//  - короткі текстові підказки (TextTile: clueMode "short" і текстові плитки
//    default-режиму) — 3 групи S/M/L, пороги в символах без крайніх
//    пробілів;
//  - довгі підказки-речення (SentenceTile: clueMode "long") — 2 групи
//    short/long, інший порядок величини (речення, не слово/переклад).
// Порядок усередині кожної групи — як у вхідному масиві (стабільне
// групування, без сортування).

export type ShortClueSizeGroup = "S" | "M" | "L";

export const SHORT_CLUE_LENGTH_S_MAX = 14;
export const SHORT_CLUE_LENGTH_M_MAX = 30;

export function shortClueSizeGroup(text: string): ShortClueSizeGroup {
  const len = text.trim().length;
  if (len <= SHORT_CLUE_LENGTH_S_MAX) return "S";
  if (len <= SHORT_CLUE_LENGTH_M_MAX) return "M";
  return "L";
}

export function groupByShortClueLength<T>(
  items: T[],
  getText: (item: T) => string
): Record<ShortClueSizeGroup, T[]> {
  const groups: Record<ShortClueSizeGroup, T[]> = { S: [], M: [], L: [] };
  for (const item of items) {
    groups[shortClueSizeGroup(getText(item))].push(item);
  }
  return groups;
}

export type SentenceSizeGroup = "short" | "long";

export const LONG_SENTENCE_LENGTH_MAX = 60;

export function sentenceSizeGroup(text: string): SentenceSizeGroup {
  return text.trim().length <= LONG_SENTENCE_LENGTH_MAX ? "short" : "long";
}

export function groupBySentenceLength<T>(
  items: T[],
  getText: (item: T) => string
): Record<SentenceSizeGroup, T[]> {
  const groups: Record<SentenceSizeGroup, T[]> = { short: [], long: [] };
  for (const item of items) {
    groups[sentenceSizeGroup(getText(item))].push(item);
  }
  return groups;
}
