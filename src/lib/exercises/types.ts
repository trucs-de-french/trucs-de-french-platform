// Повні конфігурації (з правильними відповідями) — живуть тільки на сервері.

export type FillBlankConfig = {
  instructions?: string; // текст-інструкція над вправою, напр. "Заповніть пропуски"
  template: string; // "Je {{vais|vais bien}} au cinéma."
};

// Звичайна відкрита відповідь з автоматичною текстовою перевіркою (без AI —
// це essay_check). Нормалізація/порівняння — той самий принцип, що для
// одного пропуску у fill_blank: правильно, якщо збігається з ОДНИМ з answers
// після trim+lowercase.
export type OpenAnswerConfig = {
  question: string;
  answers: string[];
};

// essay_check — AI-перевірка есе за офіційною сіткою DELF (див.
// src/lib/delf/evaluation-grids.ts). level відсутній у config старих завдань
// (до цієї фічі) — читати як `config.level ?? "B1"`. exerciseNumber
// обов'язковий для A1/A2 (по одному task-запису на вправу — Ex.1/Ex.2 не
// об'єднуються в один запис), не використовується для B1/B2 (одна вправа).
// level "A1" + exerciseNumber 1 — особливий випадок: це не есе, а формуляр
// (див. EssayFormulaireConfig нижче), config цього task-запису має форму
// EssayFormulaireConfig, а не EssayCheckConfig.
export type EssayCheckConfig = {
  prompt: string;
  criteria: string;
  level: "A1" | "A2" | "B1" | "B2";
  exerciseNumber?: 1 | 2;
};

// A1 Exercice 1 (формуляр) — фактологічна перевірка полів консигни, без
// дескрипторів продуктивності. Кожне поле — один пункт консигни (напр.
// "Prénom", "Date de naissance").
export type EssayFormulaireField = { id: string; label: string };
export type EssayFormulaireConfig = {
  level: "A1";
  exerciseNumber: 1;
  instructions?: string;
  fields: EssayFormulaireField[];
};

export type MultipleChoiceOption = { id: string; text: string; correct: boolean };
export type MultipleChoiceConfig = {
  question: string;
  display: "buttons" | "dropdown";
  options: MultipleChoiceOption[];
};

export type TrueFalseStatement = { id: string; text: string; answer: boolean };
export type TrueFalseConfig = {
  instructions?: string;
  statements: TrueFalseStatement[];
};

export type MatchingPair = { left: string; right: string };
export type MatchingConfig = {
  instructions?: string;
  pairs: MatchingPair[];
};

export type ListeningOption = { id: string; text: string; correct: boolean };
export type ListeningQuestion = { id: string; question: string; options: ListeningOption[] };
export type ListeningConfig = {
  instructions?: string;
  audioUrl: string;
  questions: ListeningQuestion[];
};

export type ReorderConfig = {
  instructions?: string;
  items: string[]; // у правильному порядку
};

export type DragDropConfig = {
  instructions?: string;
  template: string; // "Je {{vais}} au cinéma." — один варіант на пропуск
  bank: string[]; // слова для банку (правильні +, за бажанням, дистрактори)
};

export type SortColumn = { id: string; label: string };
export type SortColumnsItem = { id: string; text: string; columnId: string };
export type SortColumnsConfig = {
  instructions?: string;
  columns: SortColumn[];
  items: SortColumnsItem[];
};

// table_fill — таблиця з 2 колонками (довільні назви); для кожної клітинки
// в рядку вчитель окремо вирішує, чи вона показана текстом, чи прихована
// (поле для введення). Якщо hidden — value може містити кілька допустимих
// варіантів через "|" (той самий синтаксис, що в fill_blank).
export type TableFillRow = {
  id: string;
  left: string;
  right: string;
  leftHidden: boolean;
  rightHidden: boolean;
};
export type TableFillConfig = {
  instructions?: string;
  columnLabels: [string, string];
  rows: TableFillRow[];
};

// image_match — кілька зображень, під кожним слот для перетягування назви;
// рівно одна правильна назва на зображення (без pipe-альтернатив — назва
// береться з фіксованого банку, а не вільним текстом, тож альтернативи не
// мають сенсу, як і в drag_drop).
export type ImageMatchItem = { id: string; imageUrl: string; name: string };
export type ImageMatchConfig = {
  instructions?: string;
  items: ImageMatchItem[];
};

// flip_cards — самостійний тип без правильної відповіді (не оцінюється),
// тому повна конфігурація й публічна — одне й те саме, sanitize не потрібен.
export type FlipCard = { front: string; back: string; image_url?: string; audio_url?: string };
export type FlipCardsConfig = {
  instructions?: string;
  cards: FlipCard[];
};

// callout — текстовий інформаційний блок (Notion-подібний), не вправа:
// немає правильної відповіді, не оцінюється, повна конфігурація й публічна —
// одне й те саме (як flip_cards). content — HTML із TipTap-редактора,
// санітизований DOMPurify і при збереженні, і перед рендером.
export type CalloutStyle = "none" | "info" | "tip" | "warning" | "success" | "special";
export type CalloutConfig = {
  style: CalloutStyle;
  content: string;
};

// phonetics — довідковий список реплік/фраз із транскрипцією (IPA чи
// довільний запис) і опційним аудіо/відео на кожну; як flip_cards/callout —
// не оцінюється, повна конфігурація й публічна — одне й те саме.
export type PhoneticsItem = {
  text: string;
  transcription: string;
  mediaUrl?: string;
};
export type PhoneticsConfig = {
  instructions?: string;
  items: PhoneticsItem[];
};

// vocab_quiz — так само самостійний тип без сервера: лексика (слово+переклад)
// і так повністю видима студенту, тож перевірка відповіді відбувається на
// клієнті. sceneIds — джерела лексики (dialogue.vocab обраних сцен курсу),
// не обов'язково та сама сцена, де лежить саме завдання.
export type VocabQuizConfig = {
  sceneIds: string[];
};

// "Очищені" версії — це і йде студенту, у них немає правильних відповідей.

export type FillBlankPublic = {
  instructions?: string;
  template: string; // з {{}} замість {{вар1|вар2}}
};

export type MultipleChoicePublic = {
  question: string;
  display: "buttons" | "dropdown";
  multiple: boolean; // чи більше однієї правильної відповіді (для radio/checkbox)
  correctCount: number; // скільки саме — для підказки студенту, напр. "2 варіанти"
  options: { id: string; text: string }[];
};

export type TrueFalsePublic = {
  instructions?: string;
  statements: { id: string; text: string }[];
};

export type MatchingPublic = {
  instructions?: string;
  left: string[];
  right: string[]; // перемішано, без зв'язку з left
};

export type ListeningPublic = {
  instructions?: string;
  audioUrl: string;
  questions: { id: string; question: string; options: { id: string; text: string }[] }[];
};

export type ReorderPublic = {
  instructions?: string;
  items: string[]; // перемішано
};

export type DragDropPublic = {
  instructions?: string;
  template: string; // з {{}} замість {{слово}}
  bank: string[]; // перемішано
};

export type SortColumnsPublic = {
  instructions?: string;
  columns: SortColumn[];
  items: { id: string; text: string }[]; // без columnId, перемішано
};

export type OpenAnswerPublic = {
  question: string;
};

export type TableFillPublic = {
  instructions?: string;
  columnLabels: [string, string];
  rows: { id: string; left: string | null; right: string | null }[]; // null = прихована клітинка
};

export type ImageMatchPublic = {
  instructions?: string;
  items: { id: string; imageUrl: string }[];
  bank: string[]; // перемішані name з усіх items
};

// Відповідь студента для кожного типу.

export type FillBlankAnswer = string[]; // по одному рядку на пропуск, за порядком
export type MultipleChoiceAnswer = string[]; // вибрані option.id
export type TrueFalseAnswer = { id: string; value: boolean }[];
export type MatchingAnswer = { left: string; right: string }[];
export type ListeningAnswer = { questionId: string; optionId: string }[];
export type ReorderAnswer = string[]; // запропонований студентом порядок
export type DragDropAnswer = string[]; // по одному слову з банку на пропуск, за порядком
export type SortColumnsAnswer = { itemId: string; columnId: string }[];
export type OpenAnswerAnswer = string;
export type TableFillAnswer = { rowId: string; side: "left" | "right"; value: string }[];
export type ImageMatchAnswer = { itemId: string; name: string }[];

// Детальний результат перевірки — саме він показує "де помилка".

export type FillBlankDetail = {
  blanks: { studentAnswer: string; correctAnswers: string[]; isCorrect: boolean }[];
};

export type MultipleChoiceDetail = {
  options: { id: string; text: string; correct: boolean; selected: boolean }[];
};

export type TrueFalseDetail = {
  statements: {
    id: string;
    text: string;
    correctAnswer: boolean;
    studentAnswer: boolean | null;
    isCorrect: boolean;
  }[];
};

export type MatchingDetail = {
  correctPairs: MatchingPair[];
  studentPairs: { left: string; right: string; isCorrect: boolean }[];
};

export type ListeningDetail = {
  questions: {
    id: string;
    question: string;
    options: { id: string; text: string; correct: boolean; selected: boolean }[];
  }[];
};

export type ReorderDetail = {
  items: { text: string; correctIndex: number; studentIndex: number; isCorrect: boolean }[];
};

// drag_drop — по суті fill_blank з одним варіантом на пропуск і словами з
// фіксованого банку замість вільного вводу, тому форма деталізації та сама.
export type DragDropDetail = FillBlankDetail;

export type SortColumnsDetail = {
  items: {
    id: string;
    text: string;
    correctColumnId: string;
    correctColumnLabel: string;
    studentColumnId: string | null;
    isCorrect: boolean;
  }[];
};

export type OpenAnswerDetail = {
  studentAnswer: string;
  correctAnswers: string[];
  isCorrect: boolean;
};

export type TableFillDetail = {
  blanks: {
    rowId: string;
    side: "left" | "right";
    studentAnswer: string;
    correctAnswers: string[];
    isCorrect: boolean;
  }[];
};

export type ImageMatchDetail = {
  items: {
    id: string;
    imageUrl: string;
    correctName: string;
    studentName: string;
    isCorrect: boolean;
  }[];
};

export type GradeResult =
  | { correct: boolean; score: number; detail: FillBlankDetail }
  | { correct: boolean; score: number; detail: MultipleChoiceDetail }
  | { correct: boolean; score: number; detail: TrueFalseDetail }
  | { correct: boolean; score: number; detail: MatchingDetail }
  | { correct: boolean; score: number; detail: ListeningDetail }
  | { correct: boolean; score: number; detail: ReorderDetail }
  | { correct: boolean; score: number; detail: SortColumnsDetail }
  | { correct: boolean; score: number; detail: OpenAnswerDetail }
  | { correct: boolean; score: number; detail: TableFillDetail }
  | { correct: boolean; score: number; detail: ImageMatchDetail };
