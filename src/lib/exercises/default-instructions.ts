// Дефолтні інструкції для студента — пара {instruction, subInstruction} на
// кожен тип: instruction — французькою (основна інструкція, той самий
// рівень, що вчителька й сама писала б своєю мовою викладання), subInstruction
// — коротке пояснення українською (щоб студент зрозумів, що робити, навіть
// якщо ще не читає французьку вільно). Обидва поля в адмінці лишаються
// повністю редагованими — це лише початкове значення, підставляється при
// виборі типу (task-config-fields.tsx) і при масовому створенні
// (task-config-builder.ts), не "заморожений" текст.
//
// word_choice — єдиний тип, де дефолт залежить не лише від типу, а й від
// режиму (select/cross_out) — WORD_CHOICE_DEFAULT_INSTRUCTIONS нижче,
// окремо від цієї мапи.
//
// БЕЗ автоматичних інструкцій (немає запису тут узагалі): callout, embed,
// link, game — не вправи по суті (контент/зовнішнє посилання, немає
// "завдання" для консинги); error_correction — не редагована вправа, показує
// фіксований пояснювальний текст напряму в JSX (сторінка сцени), не через
// цю мапу; ai_examiner — ще не має власної форми.
export type InstructionDefault = { instruction: string; subInstruction: string };

// fill_blank з банком слів (config.wordBank) — окремий підзаголовок, лише
// для студентського компонента (fill-blank.tsx), коли вчителька сама не
// задала subInstructions: пояснює, що слова треба ВПИСУВАТИ самій (банк —
// довідковий список, не drag&drop), і що використані можна викреслювати.
// DEFAULT_INSTRUCTIONS.fill_blank.subInstruction нижче лишається
// незмінним — його й далі підставляють адмінський автозаповнювач
// (task-config-fields.tsx) і масове створення з вокабуляру (actions.ts),
// обидва ДО того, як відомо, чи буде банк слів у конкретній задачі.
export const FILL_BLANK_WORD_BANK_SUBINSTRUCTION =
  "Впишіть слова в пропуски самостійно. Використані викреслюйте зі списку.";

export const DEFAULT_INSTRUCTIONS: Record<string, InstructionDefault> = {
  fill_blank: { instruction: "Complétez les phrases.", subInstruction: "Впишіть пропущені слова." },
  drag_drop: { instruction: "Glissez les mots à la bonne place.", subInstruction: "Перетягніть слова в пропуски." },
  multiple_choice: { instruction: "Choisissez la bonne réponse.", subInstruction: "Оберіть правильний варіант." },
  // Пробіл перед "?" — нерозривний (U+00A0), французька типографська норма:
  // подвійний розділовий знак не переноситься на новий рядок окремо.
  true_false: { instruction: "Vrai ou faux ?", subInstruction: "Визначте, чи твердження правдиве." },
  matching: { instruction: "Associez les mots à leur traduction.", subInstruction: "З'єднайте слово з перекладом." },
  table_fill: { instruction: "Complétez le tableau.", subInstruction: "Заповніть порожні клітинки таблиці." },
  sort_columns: {
    instruction: "Classez les éléments dans la bonne colonne.",
    subInstruction: "Розкладіть елементи по колонках.",
  },
  checkbox_grid: { instruction: "Cochez les bonnes cases.", subInstruction: "Позначте правильні клітинки." },
  reorder: { instruction: "Remettez les éléments dans l'ordre.", subInstruction: "Розставте елементи в правильному порядку." },
  chronological_order: {
    instruction: "Remettez les événements dans l'ordre chronologique.",
    subInstruction: "Розставте події в хронологічному порядку.",
  },
  image_match: {
    instruction: "Associez chaque image au bon mot.",
    subInstruction: "Перетягніть слова під відповідні картинки.",
  },
  listening: { instruction: "Écoutez et répondez aux questions.", subInstruction: "Прослухайте аудіо й дайте відповіді." },
  open_answer: { instruction: "Répondez aux questions.", subInstruction: "Напишіть відповідь." },
  essay_check: {
    instruction: "Rédigez votre texte.",
    subInstruction: "Напишіть текст за завданням, його перевірить AI за критеріями DELF.",
  },
  flip_cards: { instruction: "Retournez les cartes.", subInstruction: "Клікніть на картку, щоб побачити переклад." },
  vocab_quiz: { instruction: "Testez votre vocabulaire.", subInstruction: "Оберіть правильний переклад слова." },
  phonetics: { instruction: "Écoutez et répétez.", subInstruction: "Прослухайте й повторіть." },
  letter_gaps: {
    instruction: "Complétez les mots avec les lettres manquantes.",
    subInstruction: "Впишіть пропущені літери.",
  },
  letter_rearrangement: {
    instruction: "Remettez les lettres dans l'ordre.",
    subInstruction: "Перетягніть літери, щоб скласти слово.",
  },
  word_search: {
    instruction: "Trouvez les mots dans la grille.",
    subInstruction: "Знайдіть слова в сітці, виділяючи їх мишею чи пальцем.",
  },
  crossword: { instruction: "Complétez la grille de mots croisés.", subInstruction: "Розгадайте кросворд за підказками." },
  karaoke: {
    instruction: "Écoutez la chanson et complétez les paroles.",
    subInstruction: "Слухайте пісню й заповнюйте пропуски в тексті.",
  },
};

// word_choice — дефолт залежить від режиму (WordChoiceConfig.mode), не лише
// від типу — окрема мапа замість запису в DEFAULT_INSTRUCTIONS вище.
export const WORD_CHOICE_DEFAULT_INSTRUCTIONS: Record<"select" | "cross_out", InstructionDefault> = {
  select: { instruction: "Choisissez la bonne forme.", subInstruction: "Оберіть правильну форму слова в реченні." },
  cross_out: { instruction: "Barrez l'intrus.", subInstruction: "Викресліть зайве слово." },
};

// Фіксований пояснювальний текст error_correction (не через DEFAULT_INSTRUCTIONS
// — цей тип не редагується вчителькою, instructions-поля в нього взагалі
// немає, sceneMistakes обчислюються з даних сцени).
export const ERROR_CORRECTION_INSTRUCTION =
  "Натисніть на помилку, щоб перейти до завдання і виправити відповідь";
