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
import type { UiLang } from "@/lib/ui/product-lang";
import type { TaskTypeKey } from "./default-task-labels";

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
export const FILL_BLANK_WORD_BANK_TRANSLATION_EN =
  "Type the words into the blanks yourself. Cross out the ones you've used.";

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

// Заголовок (instruction) — ЗАВЖДИ французькою, в усіх трьох мовах
// інтерфейсу, тож ніколи не проходить через t()/плюральні форми — тип не
// потребує lang. Рядок-переклад під заголовком (той самий текст, що
// DEFAULT_INSTRUCTIONS[type].subInstruction, українською) — ЗАЛЕЖИТЬ від
// ui_lang: uk — показується, fr — НЕ показується (й "/" теж), en —
// показується власний англійський варіант нижче, а якщо його нема — також
// не показується (без фолбеку на українську). EN-варіанти зберігаються
// окремим Record, а не ключами в src/lib/i18n/messages/*.ts: ключ там мав
// би бути per-type (taskInstruction.<type>.translation) з динамічним
// доступом через t(), що зламало б типізацію MessageKey — Record з тим
// самим TaskTypeKey, що й DEFAULT_INSTRUCTIONS, залишається type-safe без
// додаткового рядка в uk.ts/fr.ts (яким для fr однаково ніколи нема що
// показати).
export const DEFAULT_TRANSLATION_EN: Partial<Record<TaskTypeKey, string>> = {
  fill_blank: "Fill in the blanks.",
  drag_drop: "Drag the words into place.",
  multiple_choice: "Choose the correct answer.",
  true_false: "Choose true or false.",
  matching: "Match the pairs.",
  table_fill: "Fill in the table.",
  sort_columns: "Sort into the right columns.",
  checkbox_grid: "Check the correct boxes.",
  reorder: "Put them in the right order.",
  chronological_order: "Put the events in chronological order.",
  image_match: "Match each image to the right word.",
  listening: "Listen and answer.",
  open_answer: "Answer in writing.",
  essay_check: "Write a text.",
  flip_cards: "Flip the cards.",
  vocab_quiz: "Test your vocabulary.",
  phonetics: "Listen and repeat.",
  letter_gaps: "Fill in the missing letters.",
  letter_rearrangement: "Put the letters in the right order.",
  word_search: "Find the hidden words.",
  crossword: "Fill in the grid.",
  karaoke: "Sing along with the song.",
};

// word_choice — дефолт залежить від режиму, окремо від DEFAULT_TRANSLATION_EN
// вище (той самий принцип, що WORD_CHOICE_DEFAULT_INSTRUCTIONS).
export const WORD_CHOICE_TRANSLATION_EN: Record<"select" | "cross_out", string> = {
  select: "Choose the correct word form.",
  cross_out: "Cross out the extra word.",
};

// flip_cards у режимі "випадкова картка" — окремо від DEFAULT_TRANSLATION_EN,
// той самий принцип, що FLIP_CARDS_RANDOM_INSTRUCTIONS.
export const FLIP_CARDS_RANDOM_TRANSLATION_EN = "Draw a card.";

// Єдина точка, де "stored" (вчителькою введений subInstructions/null) і
// "fallback" (дефолт типу) з'єднуються в те, що РЕАЛЬНО показати під
// заголовком — для будь-якої мови інтерфейсу. ПРАВИЛО (не лише дефолти, а й
// вчителькою збережений текст): stored-переклад трактується як УКРАЇНСЬКИЙ
// (і тому ховається в fr/en — ми не маємо його англійського варіанту),
// дефолтний — показує uk завжди, en лише якщо для типу є запис у
// DEFAULT_TRANSLATION_EN/аналогічних мапах вище, fr — ніколи (null/undefined
// тут природно прибирає й сам рядок, і "/" у TaskInstructionLine, яка вже
// ховає обидва, коли uk-пропс порожній).
export function taskTranslationLine(
  stored: string | null | undefined,
  lang: UiLang,
  fallback: { uk: string; en?: string }
): string | undefined {
  if (stored) return lang === "uk" ? stored : undefined;
  if (lang === "uk") return fallback.uk;
  if (lang === "en") return fallback.en;
  return undefined;
}
