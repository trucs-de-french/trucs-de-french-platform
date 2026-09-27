// Єдине джерело правди для категорій вокабуляру (VocabItem.partOfSpeech,
// vocab.ts) — тип/порядок/підписи/кольори звідси, і ТІЛЬКИ звідси, читають
// адмінський select (vocab-item-row.tsx), студентська сторінка
// (vocab-section.tsx) і PDF (vocab-pdf.ts). Категорія не має CHECK/enum у
// БД — vocab живе всередині scenes.dialogue (jsonb), partOfSpeech там
// вільний рядок, тож єдиний "контракт" — саме цей файл.
export type PartOfSpeech =
  | "nom"
  | "verbe"
  | "adjectif"
  | "adverbe"
  | "prepositions_conjonctions"
  | "locutions"
  | "phrase"
  | "idiome";

// Порядок групування на студентській сторінці, у PDF і в select конструктора.
export const PART_OF_SPEECH_ORDER: PartOfSpeech[] = [
  "nom",
  "verbe",
  "adjectif",
  "adverbe",
  "prepositions_conjonctions",
  "locutions",
  "phrase",
  "idiome",
];

// Французькі підписи — і в select конструктора, і як назви груп на
// студентській сторінці/у PDF (легасі-група без категорії — виняток,
// лишається "Інше" українською, бо для неї немає французького відповідника
// в природній системі категорій).
export const PART_OF_SPEECH_LABELS_FR: Record<PartOfSpeech, string> = {
  nom: "Noms / Pronoms",
  verbe: "Verbes",
  adjectif: "Adjectifs",
  adverbe: "Adverbes",
  prepositions_conjonctions: "Prépositions / Conjonctions",
  locutions: "Locutions",
  phrase: "Phrases utiles",
  idiome: "Idiomes",
};

// dot — Tailwind-клас кольорової крапки (веб); rgb — той самий колір
// (0–1 на канал) для pdf-lib, який не читає CSS-класи. 8 кольорів підібрано
// так, щоб жодні два СУСІДНІ в PART_OF_SPEECH_ORDER не зливались відтінком:
// prepositions_conjonctions — нейтральний stone (не amber), щоб не
// зливатися з orange у Noms/Pronoms, коли обидва в одній легенді.
export const PART_OF_SPEECH_COLORS: Record<PartOfSpeech, { dot: string; rgb: [number, number, number] }> = {
  nom: { dot: "bg-orange-500", rgb: [0.976, 0.451, 0.086] },
  verbe: { dot: "bg-red-500", rgb: [0.937, 0.267, 0.267] },
  adjectif: { dot: "bg-green-500", rgb: [0.133, 0.773, 0.369] },
  adverbe: { dot: "bg-violet-500", rgb: [0.545, 0.361, 0.965] },
  prepositions_conjonctions: { dot: "bg-stone-500", rgb: [0.42, 0.396, 0.373] },
  locutions: { dot: "bg-pink-500", rgb: [0.925, 0.282, 0.6] },
  phrase: { dot: "bg-blue-500", rgb: [0.231, 0.51, 0.965] },
  idiome: { dot: "bg-cyan-500", rgb: [0.024, 0.714, 0.831] },
};

const KNOWN = new Set<string>(PART_OF_SPEECH_ORDER);

// Читає partOfSpeech так, як він міг бути записаний і ДО, і ПІСЛЯ міграції
// 0050: старий ключ "adverbe_locution" (ще не перейменований у даних)
// мапиться на новий "adverbe" тут, у ЄДИНОМУ місці — жодна інша функція чи
// компонент не порівнює partOfSpeech із рядковим літералом напряму.
// Використовується скрізь, де partOfSpeech ЧИТАЄТЬСЯ (групування,
// select-значення в конструкторі); там, де він ЗАПИСУЄТЬСЯ (onChange у
// vocab-item-row.tsx), значення й так завжди один з PART_OF_SPEECH_ORDER —
// у списку опцій select старого ключа немає.
export function normalizePartOfSpeech(raw: string | null | undefined): PartOfSpeech | null {
  if (raw === "adverbe_locution") return "adverbe";
  if (raw && KNOWN.has(raw)) return raw as PartOfSpeech;
  return null;
}
