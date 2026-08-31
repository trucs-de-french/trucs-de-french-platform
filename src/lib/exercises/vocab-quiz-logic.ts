import type { VocabItem } from "@/lib/vocab";

export type VocabQuizQuestion = {
  word: string;
  correctTranslation: string;
  options: string[]; // перемішано, довжина = min(4, унікальних слів)
};

// Менше — нема з чого взяти навіть один дистрактор.
export const MIN_VOCAB_FOR_QUIZ = 2;

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Одне питання на слово; дистрактори — з того самого пулу лексики, з
// дедуплікацією за текстом перекладу (щоб два різні слова з однаковим
// перекладом не дали два неможливо-відрізнити варіанти відповіді).
export function buildQuizQuestions(vocab: VocabItem[]): VocabQuizQuestion[] {
  if (vocab.length < MIN_VOCAB_FOR_QUIZ) return [];

  const optionCount = Math.min(4, vocab.length);

  return shuffle(vocab).map((item) => {
    const seenTranslations = new Set([item.translation]);
    const distractorPool: string[] = [];
    for (const v of vocab) {
      if (v.word === item.word || seenTranslations.has(v.translation)) continue;
      seenTranslations.add(v.translation);
      distractorPool.push(v.translation);
    }

    const distractors = shuffle(distractorPool).slice(0, optionCount - 1);
    const options = shuffle([item.translation, ...distractors]);

    return { word: item.word, correctTranslation: item.translation, options };
  });
}
