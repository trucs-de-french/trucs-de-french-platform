export type VocabItem = {
  word: string;
  translation: string;
  note?: string;
  image_url?: string;
  // Точна форма слова/фрази, як вона виглядає в перекладі репліки
  // (translationUk) — з правильним відмінком/дієвідміною, бо форма слова
  // в оригіналі й перекладі часто не збігається дослівно. Вписується
  // вручну, використовується лише для підсвітки в перекладеній колонці
  // (dialogue-line.tsx), ніяк не пов'язана з автоматичним зіставленням.
  translatedForm?: string | null;
};

type DialogueLine = {
  vocab?: VocabItem[];
};

// word може містити кілька варіантів через кому (напр. "signer, signe") —
// службові для підсвітки в скрипті (dialogue-line.tsx), студенту в таблиці
// "Словник"/PDF показуємо лише перший, основний варіант.
export function firstVocabVariant(word: string): string {
  return word.split(",")[0].trim();
}

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
