export type VocabItem = {
  word: string;
  translation: string;
  note?: string;
  image_url?: string;
};

type DialogueLine = {
  vocab?: VocabItem[];
};

// Унікальна лексика зі скрипту сцени (для типу 'vocab_quiz') — перше
// входження слова виграє, якщо воно позначене в кількох репліках. Викликач
// може об'єднати dialogue з кількох сцен перед передачею сюди, якщо джерело
// лексики — не одна сцена.
export function collectSceneVocab(dialogue: DialogueLine[]): VocabItem[] {
  const seen = new Map<string, VocabItem>();

  for (const line of dialogue) {
    for (const v of line.vocab ?? []) {
      const key = v.word.toLowerCase();
      if (!seen.has(key)) {
        seen.set(key, v);
      }
    }
  }

  return [...seen.values()];
}
