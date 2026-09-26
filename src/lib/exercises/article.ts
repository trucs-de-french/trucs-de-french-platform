// Прибирання французького артикля з початку слова — використовується
// buildConfigFromVocab (task-config-builder.ts, опція stripArticles) для
// типів, де ціла фраза "un/le/la/les/du/des/de la/de l'/l'" не потрібна
// (сітка філворда/кросворда, переставлені літери), і letter-hide.ts (щоб
// ніколи не ховати літери самого артикля в letter_gaps, навіть коли він
// не прибирається).
//
// Зворотні займенники ("se conduire", "s'allier", "s'permettre") свідомо НЕ
// в списку нижче — "se"/"s'" не артикль, тож жодного окремого винятку не
// знадобилось: слово просто не збігається з жодним патерном і лишається як є.
export type StripArticleResult = { word: string; article: string | null };

// "de la"/"de l'" йдуть першими — інакше без спільного префікса "de" з
// коротшим патерном (якого тут і нема) порядок не мав би значення: жоден із
// решти варіантів не є префіксом іншого.
const ARTICLE_PATTERN = /^(de\s+la\s+|de\s+l['’]|les\s+|des\s+|du\s+|une\s+|un\s+|le\s+|la\s+|l['’])/i;

export function stripArticle(word: string): StripArticleResult {
  const match = word.match(ARTICLE_PATTERN);
  if (!match) return { word, article: null };

  const rest = word.slice(match[0].length);
  // Після артикля нічого не лишилось (сам артикль без іменника, напр. "l'"
  // саме по собі) — нема що прибирати, повертаємо слово як є.
  if (rest.trim().length === 0) return { word, article: null };

  return { word: rest, article: match[0] };
}

// Довжина префікса, який ніколи не можна ховати в letter_gaps (артикль,
// якщо він є, інакше — сама перша літера слова, як і раніше). Одне джерело
// правди для computeAutoHiddenIndices (letter-hide.ts) і ручного кліку по
// символах (letter-gaps-fields.tsx) — обидва мають ігнорувати один і той
// самий діапазон індексів.
export function protectedPrefixLength(word: string): number {
  const { article } = stripArticle(word);
  return Math.max(1, article?.length ?? 0);
}
