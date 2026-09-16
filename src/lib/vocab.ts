export type PartOfSpeech = "nom" | "verbe" | "adjectif" | "adverbe_locution" | "phrase" | "idiome";

export type VocabItem = {
  // Стабільний ідентифікатор — потрібен, щоб плоска агрегована таблиця
  // "Вокабуляр" (vocab-table.tsx) могла зіставляти рядок із джерельною
  // реплікою надійніше за позиційний React key. Генерується один раз при
  // створенні запису (dialogue-editor.tsx addVocab); існуючі записи без id —
  // до одноразового бекфілу.
  id?: string;
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
  // Частина мови — обирається вручну в конструкторі (vocab-item-row.tsx),
  // використовується для групування студентської таблиці/PDF
  // (groupVocabByPartOfSpeech нижче). Відсутнє/порожній рядок — легасі-
  // записи без класифікації, потрапляють в окрему групу "Інше".
  partOfSpeech?: PartOfSpeech | null;
};

// Порядок групування на студентській сторінці й у PDF: Іменники → Дієслова
// → Прикметники → Прислівники/сталі вирази → Фрази → Ідіоми.
export const PART_OF_SPEECH_ORDER: PartOfSpeech[] = [
  "nom",
  "verbe",
  "adjectif",
  "adverbe_locution",
  "phrase",
  "idiome",
];

// Французькі підписи — і в select конструктора, і як назви груп на
// студентській сторінці/у PDF (легасі-група без категорії — виняток,
// лишається "Інше" українською, бо для неї немає французького відповідника
// в природній системі категорій).
export const PART_OF_SPEECH_LABELS_FR: Record<PartOfSpeech, string> = {
  nom: "Nom",
  verbe: "Verbe",
  adjectif: "Adjectif",
  adverbe_locution: "Adverbe / locution",
  phrase: "Phrase",
  idiome: "Idiome",
};

// dot — Tailwind-клас кольорової крапки (веб); rgb — той самий колір
// (0–1 на канал) для pdf-lib, який не читає CSS-класи.
export const PART_OF_SPEECH_COLORS: Record<PartOfSpeech, { dot: string; rgb: [number, number, number] }> = {
  nom: { dot: "bg-orange-500", rgb: [0.976, 0.451, 0.086] },
  verbe: { dot: "bg-red-500", rgb: [0.937, 0.267, 0.267] },
  adjectif: { dot: "bg-green-500", rgb: [0.133, 0.773, 0.369] },
  adverbe_locution: { dot: "bg-violet-500", rgb: [0.545, 0.361, 0.965] },
  phrase: { dot: "bg-blue-500", rgb: [0.231, 0.51, 0.965] },
  idiome: { dot: "bg-cyan-500", rgb: [0.024, 0.714, 0.831] },
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

export type VocabGroup = { partOfSpeech: PartOfSpeech | null; items: VocabItem[] };

// Групування для студентської таблиці "Вокабуляр"/PDF — за PART_OF_SPEECH_ORDER,
// легасі-записи без класифікації (partOfSpeech відсутнє/порожній рядок) —
// окрема група null, завжди останньою. Порядок слів У МЕЖАХ групи — той
// самий, що у вхідному vocab (простий прохід + додавання в кошик Map, без
// sort()), тож стабільний за конструкцією.
export function groupVocabByPartOfSpeech(vocab: VocabItem[]): VocabGroup[] {
  const buckets = new Map<PartOfSpeech | null, VocabItem[]>();

  for (const v of vocab) {
    const key = v.partOfSpeech || null;
    const arr = buckets.get(key) ?? [];
    arr.push(v);
    buckets.set(key, arr);
  }

  const groups: VocabGroup[] = [];
  for (const pos of PART_OF_SPEECH_ORDER) {
    const items = buckets.get(pos);
    if (items && items.length > 0) groups.push({ partOfSpeech: pos, items });
  }
  const legacy = buckets.get(null);
  if (legacy && legacy.length > 0) groups.push({ partOfSpeech: null, items: legacy });

  return groups;
}
