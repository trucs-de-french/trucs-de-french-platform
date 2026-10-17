// Дефолтна французька НАЗВА ТИПУ (коротка, для компактного бару задачі,
// GlassBlock, glass-block.tsx) — одна стала назва на кожен тип, на
// відміну від DEFAULT_INSTRUCTIONS (default-instructions.ts), де FR
// інструкція/UK пояснення вже існували й лишаються ЄДИНИМ джерелом для
// рядка інструкції заголовка панелі (task-panel-header.tsx) — тут НЕ
// дублюються.
//
// Union-тип нижче (не просто string) — щоб Record<TaskTypeKey, string>
// змушував TypeScript впасти на білді, якщо хтось додасть новий тип у
// БД-обмеження (tasks.type) і забуде рядок тут (той самий принцип
// вичерпності, що й у решті мап цього файлу).
export type TaskTypeKey =
  | "fill_blank"
  | "letter_gaps"
  | "letter_rearrangement"
  | "word_choice"
  | "multiple_choice"
  | "true_false"
  | "matching"
  | "reorder"
  | "drag_drop"
  | "sort_columns"
  | "table_fill"
  | "image_match"
  | "checkbox_grid"
  | "chronological_order"
  | "vocab_quiz"
  | "word_search"
  | "crossword"
  | "open_answer"
  | "callout"
  | "phonetics"
  | "flip_cards"
  | "essay_check"
  | "ai_examiner"
  | "listening"
  | "link"
  | "embed"
  | "game"
  | "error_correction"
  | "karaoke";

export const DEFAULT_TASK_NAME: Record<TaskTypeKey, string> = {
  letter_gaps: "Lettres manquantes",
  letter_rearrangement: "Lettres en désordre",
  word_choice: "Choix du mot",
  word_search: "Mots mêlés",
  crossword: "Mots croisés",
  flip_cards: "Cartes d'apprentissage",
  multiple_choice: "Choix multiple",
  fill_blank: "Texte à trous",
  true_false: "Vrai ou faux",
  matching: "Association",
  table_fill: "Tableau à compléter",
  drag_drop: "Glisser-déposer",
  image_match: "Images et mots",
  listening: "Compréhension orale",
  phonetics: "Phonétique",
  open_answer: "Réponse libre",
  essay_check: "Production écrite",
  reorder: "Mise en ordre",
  chronological_order: "Ordre chronologique",
  sort_columns: "Classement",
  checkbox_grid: "Grille à cocher",
  vocab_quiz: "Quiz de vocabulaire",
  karaoke: "Karaoké",
  // Типів поза даним у задачі списком (не вправи по суті/ще немає форми) —
  // короткі французькі назви "за змовчуванням", ніде детально не
  // обговорювались, легко змінити пізніше.
  callout: "Note",
  ai_examiner: "Examen oral (IA)",
  link: "Lien",
  embed: "Contenu intégré",
  game: "Jeu",
  error_correction: "Correction des erreurs",
};

// Плашка типу (BlockTabs, block-navigation.tsx) лишається тією самою для
// flip_cards незалежно від режиму ("Tirage au sort" для random_reveal
// прибрано: задача-рефакторинг смужки вимагає, щоб назва не змінювалась
// між режимами) — лише інструкція/підінструкція все ще різні
// (FLIP_CARDS_RANDOM_INSTRUCTIONS, default-instructions.ts, flip-cards.tsx).
export function getDefaultTaskName(type: string, config?: Record<string, unknown> | null): string {
  void config;
  return DEFAULT_TASK_NAME[type as TaskTypeKey] ?? type;
}

// Дефолтні FR/UK підписи секцій напрямку кросворду ("Horizontalement" /
// "Verticalement", мокап "варіант 2", crossword.tsx) — окремо від
// DEFAULT_TASK_NAME (назва ТИПУ задачі) і DEFAULT_INSTRUCTIONS (інструкція
// самої вправи): це підписи ДВОХ секцій підказок усередині однієї вправи.
export const DEFAULT_CROSSWORD_DIRECTION_LABELS: Record<
  "horizontal" | "vertical",
  { fr: string; uk: string }
> = {
  horizontal: { fr: "Horizontalement", uk: "по горизонталі" },
  vertical: { fr: "Verticalement", uk: "по вертикалі" },
};
