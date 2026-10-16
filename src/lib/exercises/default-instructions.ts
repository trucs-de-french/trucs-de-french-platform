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

// Текст оновлено під заголовок панелі "варіант 3" (task-panel-header.tsx,
// 2026) — дефолти на кожен тип тепер і джерело для НАЗВИ типу (короткої,
// default-task-labels.ts) і для рядка інструкції тут, узгоджені одним
// автором одночасно, тому можуть відрізнятись словами від попередньої
// версії цього файлу (git blame/історія — якщо потрібен старий варіант).
export const DEFAULT_INSTRUCTIONS: Record<string, InstructionDefault> = {
  fill_blank: { instruction: "Complétez les phrases.", subInstruction: "Заповніть пропуски." },
  drag_drop: { instruction: "Placez les mots au bon endroit.", subInstruction: "Перетягніть слова на місце." },
  multiple_choice: { instruction: "Choisissez la bonne réponse.", subInstruction: "Оберіть правильну відповідь." },
  true_false: { instruction: "Choisissez vrai ou faux.", subInstruction: "Оберіть «правда» чи «неправда»." },
  matching: { instruction: "Associez les éléments.", subInstruction: "З'єднайте пари." },
  table_fill: { instruction: "Complétez le tableau.", subInstruction: "Заповніть таблицю." },
  sort_columns: { instruction: "Classez dans les bonnes colonnes.", subInstruction: "Розподіліть по колонках." },
  checkbox_grid: { instruction: "Cochez les bonnes cases.", subInstruction: "Позначте правильні клітинки." },
  reorder: { instruction: "Remettez dans l'ordre.", subInstruction: "Розставте в правильному порядку." },
  chronological_order: {
    instruction: "Classez les événements dans l'ordre.",
    subInstruction: "Розташуйте події в хронологічному порядку.",
  },
  image_match: {
    instruction: "Associez chaque image au bon mot.",
    subInstruction: "З'єднайте картинки зі словами.",
  },
  listening: { instruction: "Écoutez et répondez.", subInstruction: "Послухайте й дайте відповідь." },
  open_answer: { instruction: "Répondez par écrit.", subInstruction: "Дайте письмову відповідь." },
  essay_check: { instruction: "Rédigez un texte.", subInstruction: "Напишіть текст." },
  flip_cards: { instruction: "Retournez les cartes.", subInstruction: "Перегортайте картки." },
  vocab_quiz: { instruction: "Testez votre vocabulaire.", subInstruction: "Перевірте лексику." },
  phonetics: { instruction: "Écoutez et répétez.", subInstruction: "Послухайте й повторіть." },
  letter_gaps: { instruction: "Écrivez les lettres manquantes.", subInstruction: "Впишіть пропущені літери." },
  letter_rearrangement: {
    instruction: "Remettez les lettres dans l'ordre.",
    subInstruction: "Розставте літери в правильному порядку.",
  },
  word_search: { instruction: "Trouvez les mots cachés.", subInstruction: "Знайдіть приховані слова." },
  crossword: { instruction: "Complétez la grille.", subInstruction: "Заповніть кросворд." },
  karaoke: { instruction: "Chantez avec la chanson.", subInstruction: "Співайте разом з піснею." },
};

// flip_cards у режимі "випадкова картка" (config.mode === "random_reveal")
// — окремий варіант інструкції, той самий принцип, що WORD_CHOICE_
// DEFAULT_INSTRUCTIONS нижче; flip-cards.tsx вибирає цей запис замість
// DEFAULT_INSTRUCTIONS.flip_cards лише для цього режиму.
export const FLIP_CARDS_RANDOM_INSTRUCTIONS: InstructionDefault = {
  instruction: "Tirez une carte.",
  subInstruction: "Витягніть картку.",
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
