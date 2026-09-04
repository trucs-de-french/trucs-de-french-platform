// Повні конфігурації (з правильними відповідями) — живуть тільки на сервері.

// points — пілот системи балів, Група B, останній тип. На відміну від усіх
// інших типів (де points на елементі — реченні/рядку/парі), тут ЦІЛА
// ВПРАЖА — один скаляр, без масиву елементів узагалі. Підтверджений
// компроміс: template — вільний текст без жодної структурної адресації
// пропусків (на відміну від drag_drop.sentences[], де кожне речення вже
// мало id), тож дрібніша прив'язка (масив points[] за позицією пропуску)
// була б крихкою — ламалась би мовчки при редагуванні тексту. Зараховується
// цілком, лише якщо ВСІ пропуски правильні (correct === true).
export type FillBlankConfig = {
  instructions?: string; // текст-інструкція над вправою, напр. "Заповніть пропуски"
  subInstructions?: string; // опційні додаткові інструкції (див. TrueFalseConfig)
  template: string; // "Je {{vais|vais bien}} au cinéma."
  points?: number;
  // Опційний банк слів-підказок (бульбашки) поруч зі вправою — суто
  // довідковий UI, студент і далі сам вписує відповідь в <input>. Не
  // тасується (той самий порядок, що вписав вчитель), не впливає на
  // gradeFillBlank жодним чином.
  wordBank?: string[];
};

// Звичайна відкрита відповідь з автоматичною текстовою перевіркою (без AI —
// це essay_check). Нормалізація/порівняння — той самий принцип, що для
// одного пропуску у fill_blank: правильно, якщо збігається з ОДНИМ з answers
// після trim+lowercase.
// Кілька питань під однією спільною instructions — той самий принцип, що
// listening.questions, з частковим заліком по кожному питанню. Стара пласка
// форма ({question, answers} без questions) — виродковий випадок нової,
// нормалізується на льоту в grade.ts/sanitize.ts, без міграції БД.
// points — пілот системи балів (див. TrueFalseStatement) — дефолт 1
// (resolveOpenAnswerPoints у sanitize.ts).
export type OpenAnswerQuestion = { id: string; question: string; answers: string[]; points?: number };
export type OpenAnswerConfig = {
  instructions?: string;
  subInstructions?: string; // опційні додаткові інструкції (див. TrueFalseConfig)
  questions: OpenAnswerQuestion[];
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

// Кілька речень під однією спільною instructions і спільним display — той
// самий принцип, що listening.questions. sentence для dropdown містить
// РІВНО ОДИН "{{}}" (лише позиція вибору, без альтернатив-через-| — це не
// той механізм, що BLANK_RE/gradeFillBlank: правильність і всі варіанти,
// правильні й неправильні, лишаються в options, а не у вільному тексті).
// Стара пласка форма ({question, display, options}, без items) —
// виродковий випадок нової, нормалізується на льоту (getMultipleChoiceItems),
// без міграції БД.
export type MultipleChoiceOption = { id: string; text: string; correct: boolean };
// points — пілот системи балів (див. TrueFalseStatement) — дефолт 1
// (resolveMultipleChoicePoints у sanitize.ts).
export type MultipleChoiceItem = {
  id: string;
  sentence: string;
  options: MultipleChoiceOption[];
  points?: number;
};
export type MultipleChoiceConfig = {
  instructions?: string;
  subInstructions?: string; // опційні додаткові інструкції (див. TrueFalseConfig)
  display: "buttons" | "dropdown";
  items: MultipleChoiceItem[];
};

// points — необов'язкове, дефолт 1 бал (resolveTrueFalsePoints у
// sanitize.ts) для тверджень без явного значення, щоб наявні задачі й далі
// мали сенс без ретроактивного заповнення. Це пілот системи балів
// (points_visible на tasks) — score/percentage у grade.ts лишається
// незмінним джерелом правди для прогресу/pass-fail, points — окремий шар
// лише для показу студенту.
export type TrueFalseStatement = { id: string; text: string; answer: boolean; points?: number };
export type TrueFalseConfig = {
  instructions?: string;
  // Опційні додаткові інструкції — окреме поле, не частина instructions,
  // щоб коротка головна інструкція лишалась короткою, а довші пояснення
  // (за потреби) не змушували її розтягуватись. Форматований HTML (жирний/
  // курсив/підсвітка) — санітизується і при збереженні, і при рендері
  // (sanitizeInstructionsHtml), той самий double-sanitize принцип, що callout.
  subInstructions?: string;
  statements: TrueFalseStatement[];
};

// id/points — пілот системи балів, Група B. На відміну від інших типів,
// пари ніколи не мали id взагалі (адресація й правильність — за змістом
// left/right, не за id). Стара форма (без id) — виродковий випадок нової,
// нормалізується на льоту (getMatchingPairs, стабільний синтетичний
// `pair-${index}`), без міграції БД. Бали — на рівні ПАРИ (уже атомарна
// одиниця, без під-структури).
export type MatchingPair = { id?: string; left: string; right: string; points?: number };
export type MatchingConfig = {
  instructions?: string;
  subInstructions?: string; // опційні додаткові інструкції (див. TrueFalseConfig)
  pairs: MatchingPair[];
};

export type ListeningOption = { id: string; text: string; correct: boolean };
// points — пілот системи балів (див. TrueFalseStatement) — дефолт 1
// (resolveListeningPoints у sanitize.ts).
export type ListeningQuestion = {
  id: string;
  question: string;
  options: ListeningOption[];
  points?: number;
};
export type ListeningConfig = {
  instructions?: string;
  subInstructions?: string; // опційні додаткові інструкції (див. TrueFalseConfig)
  audioUrl: string;
  questions: ListeningQuestion[];
};

// Кілька окремих послідовностей для впорядкування під однією спільною
// instructions — той самий принцип, що listening.questions/
// open_answer.questions. Стара пласка форма ({instructions?, items}, без
// sequences) — виродковий випадок нової, нормалізується на льоту в
// grade.ts/sanitize.ts (getReorderSequences), без міграції БД.
// points — пілот системи балів (дефолт 1, resolveReorderPoints у
// sanitize.ts) — свідомо на рівні ПОСЛІДОВНОСТІ, не окремої плитки:
// зараховується цілком, лише якщо ВСЯ послідовність зібрана правильно.
// Це відрізняється гранулярністю від score (атомарний по плитках через усі
// послідовності) — свідоме рішення, score і points незалежні виміри, і не
// вимагає id для кожного елемента items: string[] (що перевело б reorder у
// складність Групи B).
export type ReorderSequence = { id: string; items: string[]; points?: number }; // items — правильний порядок
export type ReorderConfig = {
  instructions?: string;
  subInstructions?: string; // опційні додаткові інструкції (див. TrueFalseConfig)
  sequences: ReorderSequence[];
};

// Кілька окремих речень із пропусками під однією спільною instructions —
// той самий принцип, що reorder.sequences. Банк слів СПІЛЬНИЙ на всю
// вправу (свідоме рішення, не per-речення) — слово, використане в одному
// реченні, недоступне для решти. Стара пласка форма ({instructions?,
// template, bank}, без sentences) — виродковий випадок нової,
// нормалізується на льоту (getDragDropSentences), без міграції БД; bank
// лишається пласким полем в обох формах, нормалізації не потребує.
// points — пілот системи балів, Група B (див. TrueFalseStatement/
// ReorderSequence) — дефолт 1 (resolveDragDropPoints у sanitize.ts).
// Свідомо на рівні РЕЧЕННЯ, не окремого пропуску — зараховується цілком,
// лише якщо ВСІ пропуски цього речення правильні. Той самий принцип, що
// вже підтверджений для reorder.sequences: score і points незалежні
// виміри різної гранулярності.
export type DragDropSentence = { id: string; template: string; points?: number }; // "Je {{vais}} au cinéma."
export type DragDropConfig = {
  instructions?: string;
  subInstructions?: string; // опційні додаткові інструкції (див. TrueFalseConfig)
  sentences: DragDropSentence[];
  bank: string[]; // слова для банку (правильні +, за бажанням, дистрактори)
};

export type SortColumn = { id: string; label: string };
// points — пілот системи балів (див. TrueFalseStatement) — дефолт 1
// (resolveSortColumnsPoints у sanitize.ts).
export type SortColumnsItem = { id: string; text: string; columnId: string; points?: number };
export type SortColumnsConfig = {
  instructions?: string;
  subInstructions?: string; // опційні додаткові інструкції (див. TrueFalseConfig)
  columns: SortColumn[];
  items: SortColumnsItem[];
};

// table_fill — таблиця з 2 колонками (довільні назви); для кожної клітинки
// в рядку вчитель окремо вирішує, чи вона показана текстом, чи прихована
// (поле для введення). Якщо hidden — value може містити кілька допустимих
// варіантів через "|" (той самий синтаксис, що в fill_blank).
// points — пілот системи балів, Група B (див. DragDropSentence) — дефолт 1
// (resolveTableFillPoints у sanitize.ts). На рівні РЯДКА (не клітинки):
// зараховується цілком, лише якщо ВСІ приховані клітинки цього рядка (1
// чи 2 — leftHidden/rightHidden незалежні) правильні. Рядки без жодної
// прихованої клітинки не мають чого оцінювати й не впливають ні на
// pointsEarned, ні на pointsPossible.
export type TableFillRow = {
  id: string;
  left: string;
  right: string;
  leftHidden: boolean;
  rightHidden: boolean;
  points?: number;
};
export type TableFillConfig = {
  instructions?: string;
  subInstructions?: string; // опційні додаткові інструкції (див. TrueFalseConfig)
  columnLabels: [string, string];
  rows: TableFillRow[];
};

// image_match — кілька зображень, під кожним слот для перетягування назви;
// рівно одна правильна назва на зображення (без pipe-альтернатив — назва
// береться з фіксованого банку, а не вільним текстом, тож альтернативи не
// мають сенсу, як і в drag_drop).
// points — пілот системи балів (див. TrueFalseStatement) — дефолт 1
// (resolveImageMatchPoints у sanitize.ts).
export type ImageMatchItem = { id: string; imageUrl: string; name: string; points?: number };
export type ImageMatchConfig = {
  instructions?: string;
  subInstructions?: string; // опційні додаткові інструкції (див. TrueFalseConfig)
  items: ImageMatchItem[];
};

// flip_cards — самостійний тип без правильної відповіді (не оцінюється),
// тому повна конфігурація й публічна — одне й те саме, sanitize не потрібен.
export type FlipCard = { front: string; back: string; image_url?: string; audio_url?: string };
export type FlipCardsConfig = {
  instructions?: string;
  subInstructions?: string; // опційні додаткові інструкції (див. TrueFalseConfig)
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
  subInstructions?: string; // опційні додаткові інструкції (див. TrueFalseConfig)
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
  subInstructions?: string;
  template: string; // з {{}} замість {{вар1|вар2}}
  points: number; // на всю вправу, не на пропуск
  wordBank?: string[]; // довідкові бульбашки, не тасується
};

export type MultipleChoicePublic = {
  instructions?: string;
  subInstructions?: string;
  display: "buttons" | "dropdown";
  items: {
    id: string;
    sentence: string;
    multiple: boolean; // чи більше однієї правильної відповіді (для radio/checkbox)
    correctCount: number; // скільки саме — для підказки студенту, напр. "2 варіанти"
    options: { id: string; text: string }[];
    points: number;
  }[];
};

export type TrueFalsePublic = {
  instructions?: string;
  subInstructions?: string;
  statements: { id: string; text: string; points: number }[]; // points завжди присутні — не секрет, як answer
};

export type MatchingPublic = {
  instructions?: string;
  subInstructions?: string;
  left: string[];
  right: string[]; // перемішано, без зв'язку з left
  // ДОДАТКОВЕ поле лише для показу балів (не замінює left/right вище і не
  // чіпає взаємодію "клікнути ліве, клікнути праве") — left тут НЕ
  // перемішаний (той самий порядок, що в left[] вище), тож студент бачить
  // бали навпроти кожного лівого елемента.
  pairs: { id: string; left: string; points: number }[];
};

export type ListeningPublic = {
  instructions?: string;
  subInstructions?: string;
  audioUrl: string;
  questions: {
    id: string;
    question: string;
    options: { id: string; text: string }[];
    points: number;
  }[];
};

export type ReorderPublic = {
  instructions?: string;
  subInstructions?: string;
  sequences: { id: string; items: string[]; points: number }[]; // items перемішано, окремо на кожну послідовність
};

export type DragDropPublic = {
  instructions?: string;
  subInstructions?: string;
  sentences: { id: string; template: string; points: number }[]; // з {{}} замість {{слово}}
  bank: string[]; // перемішано, один спільний
};

export type SortColumnsPublic = {
  instructions?: string;
  subInstructions?: string;
  columns: SortColumn[];
  items: { id: string; text: string; points: number }[]; // без columnId, перемішано
};

export type OpenAnswerPublic = {
  instructions?: string;
  subInstructions?: string;
  questions: { id: string; question: string; points: number }[];
};

export type TableFillPublic = {
  instructions?: string;
  subInstructions?: string;
  columnLabels: [string, string];
  rows: { id: string; left: string | null; right: string | null; points: number }[]; // null = прихована клітинка
};

export type ImageMatchPublic = {
  instructions?: string;
  subInstructions?: string;
  items: { id: string; imageUrl: string; points: number }[];
  bank: string[]; // перемішані name з усіх items
};

// Відповідь студента для кожного типу.

export type FillBlankAnswer = string[]; // по одному рядку на пропуск, за порядком
export type MultipleChoiceAnswer = { itemId: string; selected: string[] }[]; // вибрані option.id на кожне речення
export type TrueFalseAnswer = { id: string; value: boolean }[];
export type MatchingAnswer = { left: string; right: string }[];
export type ListeningAnswer = { questionId: string; optionId: string }[];
export type ReorderAnswer = { sequenceId: string; order: string[] }[]; // порядок на кожну послідовність
export type DragDropAnswer = { sentenceId: string; words: string[] }[]; // слова на кожен пропуск, за реченням
export type SortColumnsAnswer = { itemId: string; columnId: string }[];
export type OpenAnswerAnswer = { questionId: string; value: string }[];
export type TableFillAnswer = { rowId: string; side: "left" | "right"; value: string }[];
export type ImageMatchAnswer = { itemId: string; name: string }[];

// Детальний результат перевірки — саме він показує "де помилка".

export type FillBlankDetail = {
  blanks: { studentAnswer: string; correctAnswers: string[]; isCorrect: boolean }[];
};

export type MultipleChoiceDetail = {
  items: {
    id: string;
    options: { id: string; text: string; correct: boolean; selected: boolean }[];
    points: number;
  }[];
};

export type TrueFalseDetail = {
  statements: {
    id: string;
    text: string;
    correctAnswer: boolean;
    studentAnswer: boolean | null;
    isCorrect: boolean;
    points: number;
  }[];
};

export type MatchingDetail = {
  correctPairs: MatchingPair[];
  studentPairs: { left: string; right: string; isCorrect: boolean }[];
  // ДОДАТКОВЕ поле лише для підрахунку/показу балів — незалежне від
  // correctPairs/studentPairs вище (їх рендер не змінюється).
  pairPoints: { id: string; left: string; points: number; isCorrect: boolean }[];
};

export type ListeningDetail = {
  questions: {
    id: string;
    question: string;
    options: { id: string; text: string; correct: boolean; selected: boolean }[];
    points: number;
  }[];
};

export type ReorderDetail = {
  sequences: {
    id: string;
    items: { text: string; correctIndex: number; studentIndex: number; isCorrect: boolean }[];
    points: number;
  }[];
};

// drag_drop — по суті fill_blank з одним варіантом на пропуск і словами з
// фіксованого банку замість вільного вводу (звідси й перевикористання
// gradeFillBlank у grade.ts, по одному разу на речення), але з кількома
// реченнями форма деталізації вже не та сама пласка, що FillBlankDetail.
export type DragDropDetail = {
  sentences: {
    id: string;
    blanks: { studentAnswer: string; correctAnswers: string[]; isCorrect: boolean }[];
    points: number;
  }[];
};

export type SortColumnsDetail = {
  items: {
    id: string;
    text: string;
    correctColumnId: string;
    correctColumnLabel: string;
    studentColumnId: string | null;
    isCorrect: boolean;
    points: number;
  }[];
};

export type OpenAnswerDetail = {
  questions: {
    id: string;
    question: string;
    studentAnswer: string;
    correctAnswers: string[];
    isCorrect: boolean;
    points: number;
  }[];
};

export type TableFillDetail = {
  blanks: {
    rowId: string;
    side: "left" | "right";
    studentAnswer: string;
    correctAnswers: string[];
    isCorrect: boolean;
    points: number; // однакове для обох клітинок одного рядка — бали на рядок, не на клітинку
  }[];
};

export type ImageMatchDetail = {
  items: {
    id: string;
    imageUrl: string;
    correctName: string;
    studentName: string;
    isCorrect: boolean;
    points: number;
  }[];
};

// pointsEarned/pointsPossible — опційний шар балів ПОРЯД зі score (не
// заміна): score/percentage лишається джерелом правди для прогресу/
// pass-fail (напр. DelfTestGrid уже рахує pass/fail як middle 0-100 score),
// points — лише для показу студенту. Спільні на весь union, щоб додавання
// підтримки балів для наступного типу не вимагало знову чіпати цей тип —
// поки що їх заповнює лише gradeTrueFalse (пілот), решта лишають undefined.
export type GradeResult =
  | { correct: boolean; score: number; detail: FillBlankDetail; pointsEarned?: number; pointsPossible?: number }
  | { correct: boolean; score: number; detail: MultipleChoiceDetail; pointsEarned?: number; pointsPossible?: number }
  | { correct: boolean; score: number; detail: TrueFalseDetail; pointsEarned?: number; pointsPossible?: number }
  | { correct: boolean; score: number; detail: MatchingDetail; pointsEarned?: number; pointsPossible?: number }
  | { correct: boolean; score: number; detail: ListeningDetail; pointsEarned?: number; pointsPossible?: number }
  | { correct: boolean; score: number; detail: ReorderDetail; pointsEarned?: number; pointsPossible?: number }
  | { correct: boolean; score: number; detail: DragDropDetail; pointsEarned?: number; pointsPossible?: number }
  | { correct: boolean; score: number; detail: SortColumnsDetail; pointsEarned?: number; pointsPossible?: number }
  | { correct: boolean; score: number; detail: OpenAnswerDetail; pointsEarned?: number; pointsPossible?: number }
  | { correct: boolean; score: number; detail: TableFillDetail; pointsEarned?: number; pointsPossible?: number }
  | { correct: boolean; score: number; detail: ImageMatchDetail; pointsEarned?: number; pointsPossible?: number };
