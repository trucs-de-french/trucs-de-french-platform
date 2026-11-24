// "Робота над помилками", пілот частина 1 — чисті функції (без React/
// Supabase), спільні для сервера (page.tsx, practice/check, practice/reveal)
// і майбутнього клієнта (частина 2, редизайн вигляду). Жодна з них не читає
// БД і не має побічних ефектів.

import { BLANK_RE, getMultipleChoiceItems, getMatchingPairs, getDragDropSentences, getTableFillRows } from "./sanitize";

// Типи, виключені зі списку "Робота над помилками" взагалі (essay_check —
// окрема DELF-перевірка Gemini; word_search/crossword/karaoke — ціла
// сітка/рядок, не список окремих елементів; vocab_quiz — не пише в
// mistakes). Перенесено сюди з page.tsx (0001_init.sql+scene page), бо
// reviewMode() має знати про винятки, а не лише фільтр рендеру.
export const ERROR_REVIEW_EXCLUDED_TASK_TYPES = [
  "essay_check",
  "word_search",
  "crossword",
  "karaoke",
  "vocab_quiz",
] as const;

// Пілот: повна реалізація режиму "items" (переробка лише неправильних
// елементів) — частина 1 (multiple_choice, fill_blank), частина 3
// (true_false, word_choice, letter_gaps), частина 4 (letter_rearrangement),
// частина 5 (matching). Решта типів класифікації "items" нижче тимчасово
// повертають "whole", доки не реалізовані.
export const PRACTICE_ITEMS_TASK_TYPES = [
  "multiple_choice",
  "fill_blank",
  "true_false",
  "word_choice",
  "letter_gaps",
  "letter_rearrangement",
  "matching",
  "table_fill",
  "drag_drop",
  "image_match",
  "listening",
] as const;
export type PracticeItemsTaskType = (typeof PRACTICE_ITEMS_TASK_TYPES)[number];

// Повна класифікація "items" (мета-ціль пілота, задача 2) — елементи, що
// підлягають переробці поокремо. Наразі лише PRACTICE_ITEMS_TASK_TYPES з
// цього списку мають реальну реалізацію mistakeItemIds/itemsInDetail —
// решта тут лише документує майбутній план, reviewMode() для них повертає
// "whole".
const ITEMS_MODE_TASK_TYPES = ["open_answer"] as const;

// Класифікація "whole" (переробляється ЦІЛЕ завдання, не елемент) —
// остаточна, не тимчасова. Розширюється по одному типу за раз (частина 7,
// хвиля 3: reorder → chronological_order → sort_columns → checkbox_grid,
// той самий принцип поступового розширення, що PRACTICE_ITEMS_TASK_TYPES
// вище) — типи, яких тут ще немає, і далі отримують reviewMode()==="whole"
// через дефолтний фолбек (той самий mode, що список нижче повернув би, якби
// вони в ньому вже були, — reviewMode() не залежить від цього списку для
// значення mode, лише isWholePracticeTaskType нижче розрізняє "є реальна
// практика" від "ще немає", buildErrorReviewEntry/practice/check/
// practice/reveal звіряють саме isWholePracticeTaskType, не mode==="whole").
export const WHOLE_MODE_TASK_TYPES = [
  "reorder",
  "chronological_order",
  "sort_columns",
  "checkbox_grid",
] as const;
export type WholePracticeTaskType = (typeof WHOLE_MODE_TASK_TYPES)[number];

export function isWholePracticeTaskType(taskType: string): taskType is WholePracticeTaskType {
  return (WHOLE_MODE_TASK_TYPES as readonly string[]).includes(taskType);
}

// Єдине правило "цей тип має РЕАЛЬНУ практику" (не лише reviewMode !== "none") —
// той самий критерій, що inline-фільтр pilotTaskIds у сценовій сторінці
// (scenes/[sceneId]/page.tsx), звідси й винесено: обидва місця МАЮТЬ лишатись
// синхронізованими (той самий isPracticeItemsTaskType(t) || isWholePracticeTaskType(t)),
// бо лише ці типи мають гілку практики в error-review-block.tsx/practice/check —
// reviewMode()==="whole" для НЕпідтримуваних типів (open_answer тощо) теж
// true, але практики для них немає. Використовується standalone-сторінкою
// "Робота над помилками" (mistakes-overview.ts) для того самого списку, що
// вже рендерить сценова сторінка.
export function isMistakePracticeSupported(taskType: string): boolean {
  return isPracticeItemsTaskType(taskType) || isWholePracticeTaskType(taskType);
}

// Сурогатний ідентифікатор "елемента" для whole-режиму — усе завдання є
// ОДНИМ елементом з точки зору mistake_corrections (corrected_item_ids/
// failed_attempts), той самий механізм зберігання, що й items-режим, просто
// з рівно одним можливим id замість одного на кожен item.
export const WHOLE_TASK_ITEM_ID = "__task__";

export type ReviewMode = "items" | "whole" | "none";

export function reviewMode(taskType: string): ReviewMode {
  if ((ERROR_REVIEW_EXCLUDED_TASK_TYPES as readonly string[]).includes(taskType)) return "none";
  if ((PRACTICE_ITEMS_TASK_TYPES as readonly string[]).includes(taskType)) return "items";
  if ((WHOLE_MODE_TASK_TYPES as readonly string[]).includes(taskType)) return "whole";
  if ((ITEMS_MODE_TASK_TYPES as readonly string[]).includes(taskType)) return "whole"; // тимчасово, до реалізації
  return "whole";
}

export function isPracticeItemsTaskType(taskType: string): taskType is PracticeItemsTaskType {
  return (PRACTICE_ITEMS_TASK_TYPES as readonly string[]).includes(taskType);
}

type MultipleChoiceDetailLike = {
  items: { id: string; options: { correct: boolean; selected: boolean }[] }[];
};
type FillBlankDetailLike = { blanks: { isCorrect: boolean }[] };
type TrueFalseDetailLike = { statements: { id: string; isCorrect: boolean }[] };
type WordChoiceDetailLike = { sentences: { id: string; isCorrect: boolean }[] };
// НЕМАЄ id-поля (на відміну від true_false/word_choice) — gradeLetterGaps
// (grade.ts) позиційний, "елемент" тут String(wordIndex), той самий
// принцип, що fill_blank/String(blankIndex). correctLetters/studentLetters
// — для РОЗРІЗНЕННЯ "слово поза скоупом цього конкретного check" (блокова
// вправа >10 слів, letter-gaps.tsx шле null на позиції слів ІНШОГО блоку —
// gradeLetterGaps перетворює null на studentLetters:[], detail.words
// лишається ПОВНОЇ довжини завжди) від "слово реально перевірялось, просто
// неправильно" — studentLetters.length !== correctLetters.length означає
// перше (виключити з itemsInDetail, інакше кожен mistakes-рядок блокової
// вправи хибно позначав би СЛОВА ІНШИХ БЛОКІВ як помилку).
type LetterGapsDetailLike = {
  words: { studentLetters: string[]; correctLetters: string[]; isCorrect: boolean }[];
};

function letterGapsInScope(w: { studentLetters: string[]; correctLetters: string[] }): boolean {
  return w.correctLetters.length > 0 && w.studentLetters.length === w.correctLetters.length;
}

// На відміну від LetterGapsDetailLike, gradeLetterRearrangement будує
// letters з correctWord (ЗАВЖДИ повної довжини) незалежно від скоупу —
// довжина тут нічого не каже про те, чи слово реально входило в answer.
// Скоуп прийшов явним полем inScope (grade.ts: gradeLetterRearrangement).
type LetterRearrangementDetailLike = {
  words: { isCorrect: boolean; inScope?: boolean }[];
};

// Записи mistakes, створені ДО цього поля (commit bf65e5d), не мають
// inScope у збереженому ai_feedback взагалі — undefined тут означає "старий
// запис, перевірка завжди покривала всю вправу" (блоків/практики для
// letter_rearrangement тоді ще не існувало), тому трактуємо як true, а не
// false (інакше всі старі помилки letter_rearrangement зникли б зі
// списку "Робота над помилками" заднім числом).
function letterRearrangementInScope(w: { inScope?: boolean }): boolean {
  return w.inScope ?? true;
}

// Пара — елемент matching (частина 5). pairPoints (grade.ts: gradeMatching,
// Group B points pilot, commit c9036bf — передує цій задачі, тож на момент
// увімкнення items-режиму кожен запис matching уже мав це поле, жодного
// проміжного "старого формату без pairPoints" для items-режиму не існує,
// на відміну від letter_rearrangement/inScope вище) уже СКОУПЛЕНИЙ на пари
// ЦЬОГО конкретного check (gradeMatching: completePairs фільтрує за
// answeredLefts — пари ІНШОГО блоку просто відсутні в масиві) — явного
// поля inScope, як у letter_rearrangement, не потрібно.
type MatchingDetailLike = { pairPoints: { id: string; isCorrect: boolean }[] };

// Рядок — елемент table_fill (частина 6, хвиля 1). На відміну від
// matching/pairPoints, blanks тут НЕ один запис на елемент — рядок з ОБОМА
// прихованими клітинками (leftHidden і rightHidden) дає ДВА записи blanks з
// однаковим rowId (gradeTableFill, grade.ts) — елемент "правильний" лише
// коли ВСІ його blanks правильні (та сама гранулярність, що points/
// hintsReducePoints уже рахують на рівні рядка). Рядки без жодної
// прихованої клітинки не потрапляють у blanks взагалі — не проблема (вони й
// так не можуть бути помилкою). Скоуп (блокова вправа >10 рядків) уже
// вбудований у gradeTableFill через answeredRowIds — тут додаткового inScope
// поля, як у letter_rearrangement, не потрібно (той самий принцип, що
// matching/pairPoints).
type TableFillDetailLike = { blanks: { rowId: string; isCorrect: boolean }[] };

// Речення — елемент drag_drop (частина 6, хвиля 1), той самий принцип, що
// table_fill/рядок: кожне речення має кілька blanks (gradeDragDrop,
// grade.ts, реалізовано через gradeFillBlank на речення), елемент
// "правильний" лише коли ВСІ його blanks правильні (та сама гранулярність,
// що points/hintsReducePoints). На відміну від table_fill, gradeDragDrop НЕ
// скоупить sentences за присутністю в answer (завжди ВСІ речення
// config) — не є проблемою: drag_drop не підтримує блоки взагалі
// (EXERCISE_BLOCK_SIZE не застосовується, drag-drop.tsx не має
// submitBlock), тож itemsInDetail завжди покриває всю вправу.
type DragDropDetailLike = { sentences: { id: string; blanks: { isCorrect: boolean }[] }[] };

// Елемент — одна картинка (item.id), той самий простий item-рівень, що
// gradeChronologicalOrder, без групування (на відміну від table_fill/
// drag_drop). gradeImageMatch теж НЕ скоупить items за присутністю в
// answer (завжди ВСІ items config, той самий принцип, що drag_drop —
// image_match не підтримує блоки взагалі).
type ImageMatchDetailLike = { items: { id: string; isCorrect: boolean }[] };

// Питання — елемент listening (частина 6, хвиля 1), той самий
// multiple_choice-принцип (options з correct/selected, не окрема
// isCorrect — рахуємо тут). gradeListening теж НЕ скоупить питання за
// присутністю в answer (завжди ВСІ questions config) — listening не
// підтримує блоки взагалі.
type ListeningDetailLike = {
  questions: { id: string; options: { correct: boolean; selected: boolean }[] }[];
};

// Ідентифікатори елементів, що в цьому detail НЕПРАВИЛЬНІ (не отримали
// повних балів). null — тип поки не підтримує "items"-розбір (reviewMode
// для нього і так "whole"/"none", викликати для нього цю функцію не варто).
export function mistakeItemIds(taskType: string, detail: unknown): string[] | null {
  if (!detail || typeof detail !== "object") return null;
  const d = detail as Record<string, unknown>;

  if (taskType === "fill_blank" && Array.isArray(d.blanks)) {
    return (d as FillBlankDetailLike).blanks
      .map((b, i) => (b.isCorrect ? null : String(i)))
      .filter((id): id is string => id !== null);
  }

  if (taskType === "multiple_choice" && Array.isArray(d.items)) {
    return (d as MultipleChoiceDetailLike).items
      .filter((it) => !it.options.every((o) => o.correct === o.selected))
      .map((it) => it.id);
  }

  if (taskType === "true_false" && Array.isArray(d.statements)) {
    return (d as TrueFalseDetailLike).statements.filter((s) => !s.isCorrect).map((s) => s.id);
  }

  if (taskType === "word_choice" && Array.isArray(d.sentences)) {
    return (d as WordChoiceDetailLike).sentences.filter((s) => !s.isCorrect).map((s) => s.id);
  }

  if (taskType === "letter_gaps" && Array.isArray(d.words)) {
    return (d as LetterGapsDetailLike).words
      .map((w, i) => (letterGapsInScope(w) && !w.isCorrect ? String(i) : null))
      .filter((id): id is string => id !== null);
  }

  if (taskType === "letter_rearrangement" && Array.isArray(d.words)) {
    return (d as LetterRearrangementDetailLike).words
      .map((w, i) => (letterRearrangementInScope(w) && !w.isCorrect ? String(i) : null))
      .filter((id): id is string => id !== null);
  }

  if (taskType === "matching" && Array.isArray(d.pairPoints)) {
    return (d as MatchingDetailLike).pairPoints.filter((p) => !p.isCorrect).map((p) => p.id);
  }

  if (taskType === "table_fill" && Array.isArray(d.blanks)) {
    const blanks = (d as TableFillDetailLike).blanks;
    const rowIds = [...new Set(blanks.map((b) => b.rowId))];
    return rowIds.filter((id) => blanks.some((b) => b.rowId === id && !b.isCorrect));
  }

  if (taskType === "drag_drop" && Array.isArray(d.sentences)) {
    return (d as DragDropDetailLike).sentences
      .filter((s) => !s.blanks.every((b) => b.isCorrect))
      .map((s) => s.id);
  }

  if (taskType === "image_match" && Array.isArray(d.items)) {
    return (d as ImageMatchDetailLike).items.filter((i) => !i.isCorrect).map((i) => i.id);
  }

  if (taskType === "listening" && Array.isArray(d.questions)) {
    return (d as ListeningDetailLike).questions
      .filter((q) => !q.options.every((o) => o.correct === o.selected))
      .map((q) => q.id);
  }

  return null;
}

// "Застарілі виправлення ховають нову помилку" (аудит, Case A) —
// recordTaskAttempt (progress.ts) викликає це ПІСЛЯ вставки нового рядка
// mistakes, щоб одразу прибрати ці id з mistake_corrections.
// corrected_item_ids/failed_attempts (RPC clear_mistake_corrections,
// 0071): інакше елемент, що колись був виправлений у режимі практики, а
// потім знову провалений у ЗВИЧАЙНІЙ (не практичній) перевірці, назавжди
// лишався б "виправленим" у buildErrorReviewEntry (remainingItemIds =
// wrongItemIds.filter(id => !correctedSet.has(id)) вище — correctedSet
// ніколи сам не зменшується) — те саме читають practice/check
// (remainingItemIds там) і всі споживачі buildErrorReviewEntry
// (scene-error-review.ts, mistakes-overview.ts), тож досить виправити
// дані, UI-код не чіпається.
//
// items-типи — ті самі id, що mistakeItemIds вище (і що aggregateWrongItems
// зрештою використовує): detail щойно прийшов зі свіжої gradeAnswer-
// перевірки проти АКТУАЛЬНОГО config, тож тут не потрібна додаткова
// звірка на "привидів" (currentIdBasedIds/positionalCount), яку робить
// aggregateWrongItems для СТАРИХ рядків mistakes. whole-типи з реальною
// практикою — єдиний синтетичний id (WHOLE_TASK_ITEM_ID), вирішується
// лише прапорцем correct (у detail немає універсальної "список елементів"
// форми для всіх whole-типів). Решта (виключені типи, ще не реалізовані
// whole-типи) — нічого очищати.
export function idsToClearAfterMistake(taskType: string, detail: unknown, correct: boolean): string[] {
  if (isPracticeItemsTaskType(taskType)) {
    return mistakeItemIds(taskType, detail) ?? [];
  }
  if (isWholePracticeTaskType(taskType) && !correct) {
    return [WHOLE_TASK_ITEM_ID];
  }
  return [];
}

// Усі ідентифікатори елементів, присутні в цьому detail (правильні й ні) —
// визначає, які елементи цей конкретний mistakes-рядок "покриває" (весь
// запис чи лише один блок вправи).
export function itemsInDetail(taskType: string, detail: unknown): string[] | null {
  if (!detail || typeof detail !== "object") return null;
  const d = detail as Record<string, unknown>;

  if (taskType === "fill_blank" && Array.isArray(d.blanks)) {
    return (d as FillBlankDetailLike).blanks.map((_, i) => String(i));
  }

  if (taskType === "multiple_choice" && Array.isArray(d.items)) {
    return (d as MultipleChoiceDetailLike).items.map((it) => it.id);
  }

  if (taskType === "true_false" && Array.isArray(d.statements)) {
    return (d as TrueFalseDetailLike).statements.map((s) => s.id);
  }

  if (taskType === "word_choice" && Array.isArray(d.sentences)) {
    return (d as WordChoiceDetailLike).sentences.map((s) => s.id);
  }

  if (taskType === "letter_gaps" && Array.isArray(d.words)) {
    return (d as LetterGapsDetailLike).words
      .map((w, i) => (letterGapsInScope(w) ? String(i) : null))
      .filter((id): id is string => id !== null);
  }

  if (taskType === "letter_rearrangement" && Array.isArray(d.words)) {
    return (d as LetterRearrangementDetailLike).words
      .map((w, i) => (letterRearrangementInScope(w) ? String(i) : null))
      .filter((id): id is string => id !== null);
  }

  if (taskType === "matching" && Array.isArray(d.pairPoints)) {
    return (d as MatchingDetailLike).pairPoints.map((p) => p.id);
  }

  if (taskType === "table_fill" && Array.isArray(d.blanks)) {
    return [...new Set((d as TableFillDetailLike).blanks.map((b) => b.rowId))];
  }

  if (taskType === "drag_drop" && Array.isArray(d.sentences)) {
    return (d as DragDropDetailLike).sentences.map((s) => s.id);
  }

  if (taskType === "image_match" && Array.isArray(d.items)) {
    return (d as ImageMatchDetailLike).items.map((i) => i.id);
  }

  if (taskType === "listening" && Array.isArray(d.questions)) {
    return (d as ListeningDetailLike).questions.map((q) => q.id);
  }

  return null;
}

export type MistakeRowLike = { createdAt: string; detail: unknown };

// Помилки елемента по ВСІХ записах mistakes цього завдання, не лише
// найновішому — для блокових вправ (word_choice/multiple_choice/true_false/
// reorder/open_answer/matching/table_fill/... з CARD_BLOCK_MAX чи
// EXERCISE_BLOCK_SIZE) кожен mistakes-рядок несе detail ЛИШЕ того блоку, що
// саме перевіряли (progress.ts: ai_feedback = result.detail, без
// blockIndex-колонки в таблиці) — тож стан елемента береться з НАЙНОВІШОГО
// запису, у detail якого цей елемент присутній (itemsInDetail), а не просто
// з найновішого запису завдання загалом.
//
// Відоме обмеження (те саме, що й для вже існуючих блокових типів): якщо
// блок спершу перевірили з помилкою, а потім перевірили ЩЕ РАЗ без
// помилок — цей другий запис перекриє перший (бо новіший і елемент у ньому
// присутній), елемент коректно зникне зі списку. Але якщо блок, у якому
// була помилка, просто НЕ перевіряли повторно — застарілий запис із
// помилкою й далі вважається чинним (так само, як для одноблочних вправ
// зараз) — це не вада цієї функції, а наявна поведінка mistakes.
//
// Поточні валідні id елементів (id-адресовані типи) за АКТУАЛЬНИМ config —
// null, якщо тип позиційний (fill_blank/letter_gaps/letter_rearrangement,
// звіряються інакше, через currentPositionalCount) чи взагалі не items-типу.
// Той самий getXxx-нормалізатор, що вже використовує grade.ts/sanitize.ts
// для кожного типу (легасі "пласка" форма multiple_choice/matching/
// drag_drop/table_fill зводиться до тієї самої форми, що й реальна
// перевірка бачить, а не до сирого config напряму).
function currentIdBasedIds(taskType: string, config: Record<string, unknown>): string[] | null {
  switch (taskType) {
    case "multiple_choice":
      return getMultipleChoiceItems(config as never).map((i) => i.id);
    case "true_false":
      return Array.isArray(config.statements)
        ? (config.statements as { id: string }[]).map((s) => s.id)
        : [];
    case "word_choice":
      return Array.isArray(config.sentences) ? (config.sentences as { id: string }[]).map((s) => s.id) : [];
    case "matching":
      return getMatchingPairs(config as never).map((p) => p.id);
    case "table_fill":
      return getTableFillRows(config as never).map((r) => r.id);
    case "drag_drop":
      return getDragDropSentences(config as never).map((s) => s.id);
    case "image_match":
      return Array.isArray(config.items) ? (config.items as { id: string }[]).map((i) => i.id) : [];
    case "listening":
      return Array.isArray(config.questions) ? (config.questions as { id: string }[]).map((q) => q.id) : [];
    default:
      return null;
  }
}

// Поточна кількість позиційних елементів (fill_blank/letter_gaps/
// letter_rearrangement — "елемент" тут String(index), не id) — null для
// решти типів. fill_blank рахує пропуски тим самим BLANK_RE, що
// gradeFillBlank (grade.ts), щоб не розходитись із реальною перевіркою.
function currentPositionalCount(taskType: string, config: Record<string, unknown>): number | null {
  if (taskType === "letter_gaps" || taskType === "letter_rearrangement") {
    return Array.isArray(config.words) ? config.words.length : 0;
  }
  if (taskType === "fill_blank") {
    const template = typeof config.template === "string" ? config.template : "";
    return [...template.matchAll(BLANK_RE)].length;
  }
  return null;
}

// Сира (без filterInScope) кількість позиційних елементів у ЦЬОМУ
// detail-рядку старої спроби — на відміну від itemsInDetail (яка для
// letter_gaps/letter_rearrangement уже звужує до "елементів, перевірених
// САМЕ в цьому запиті", тобто може бути МЕНШЕ за повну кількість слів
// завдання в блокових вправах), тут потрібна ПОВНА довжина масиву
// detail.words/blanks на момент запису — вона завжди дорівнює кількості
// елементів завдання станом на той check (letter-gaps.tsx/grade.ts ніколи
// не укорочують сам масив, лише позначають слова поза скоупом через
// studentLetters:[]). Використовується лише для звірки "чи змінилась
// кількість елементів із тих пір" (крок 2, п.2) — не для списку id.
function positionalTotalInDetail(taskType: string, detail: unknown): number | null {
  if (!detail || typeof detail !== "object") return null;
  const d = detail as Record<string, unknown>;
  if (taskType === "fill_blank" && Array.isArray(d.blanks)) return d.blanks.length;
  if ((taskType === "letter_gaps" || taskType === "letter_rearrangement") && Array.isArray(d.words)) {
    return d.words.length;
  }
  return null;
}

// currentConfig — АКТУАЛЬНИЙ config завдання (null/undefined — викликач не
// має конфігу, поведінка як раніше, без звірки). Коли переданий:
// id-адресовані типи відкидають id, яких уже немає в поточному завданні
// (видалений елемент — інакше "привид" у wrongItemIds/remainingItemIds
// ніколи не зникає, і блок застряг би на "partial" назавжди); позиційні
// типи відкидають ЦІЛИЙ рядок mistakes, чия кількість елементів не
// збігається з поточною (доданий/видалений елемент зсуває індекси — старий
// індекс після зсуву вказує вже на ІНШИЙ елемент, не на той, що реально був
// неправильним).
export function aggregateWrongItems(
  rows: MistakeRowLike[],
  taskType: string,
  currentConfig?: Record<string, unknown> | null
): string[] {
  const sorted = [...rows].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  const seen = new Set<string>();
  const wrong = new Set<string>();

  const validIds = currentConfig ? currentIdBasedIds(taskType, currentConfig) : null;
  const positionalCount = currentConfig ? currentPositionalCount(taskType, currentConfig) : null;

  for (const row of sorted) {
    const ids = itemsInDetail(taskType, row.detail);
    if (!ids) continue;

    if (positionalCount !== null) {
      const rowTotal = positionalTotalInDetail(taskType, row.detail);
      if (rowTotal !== null && rowTotal !== positionalCount) continue;
    }

    const wrongIds = new Set(mistakeItemIds(taskType, row.detail) ?? []);
    for (const id of ids) {
      if (validIds !== null && !validIds.includes(id)) continue;
      if (seen.has(id)) continue;
      seen.add(id);
      if (wrongIds.has(id)) wrong.add(id);
    }
  }

  // Задача "unanswered items from unattempted blocks never reach mistakes" —
  // елемент блокової вправи, що студент ЖОДНОГО РАЗУ не торкався (інший
  // блок, що так і не був відкритий/зданий), НЕ потрапляє в `ids` ЖОДНОГО
  // mistakes-рядка взагалі (letterGapsInScope/letterRearrangementInScope
  // виключають його з itemsInDetail для кожного рядка, що його не
  // стосувався; gradeMultipleChoice/gradeTrueFalse/gradeWordChoice/
  // gradeMatching/gradeTableFill узагалі ОПУСКАЮТЬ такий елемент із
  // detail-масиву) — тож він ніколи не з'являється в `seen` і мовчки
  // випадає зі списку помилок, хоча студент його так і не виправив.
  // Продуктове правило: "незаповнене = неправильно" для КОЖНОГО елемента
  // блокової вправи, не лише для того, що потрапив у ОСТАННІЙ check. Тут —
  // єдина, спільна точка виправлення для всіх типів одразу: будь-який
  // валідний (currentConfig) id/позиція, що ніколи НЕ зустрівся в жодному
  // рядку вище (!seen.has(id)), автоматично рахується неправильним.
  //
  // Це НЕ скасовує саму причину letterGapsInScope/-RearrangementInScope
  // існувати (їхня мета лишається законною): без per-рядкового скоупу
  // НАЙНОВІШИЙ рядок (скажімо, повторна перевірка лише блоку 1) хибно
  // "захопив" би своїм null-заповненням блок 2 як WRONG, перекривши більш
  // старий рядок, де блок 2 насправді перевірявся і був ВИПРАВЛЕНИЙ —
  // регресія, якої цей фолбек навмисно уникає: він додає id лише тоді, коли
  // його ЖОДЕН рядок не бачив РЕАЛЬНО, а не коли найновіший рядок його
  // просто не стосувався.
  if (validIds !== null) {
    for (const id of validIds) {
      if (!seen.has(id)) wrong.add(id);
    }
  } else if (positionalCount !== null) {
    for (let i = 0; i < positionalCount; i++) {
      const id = String(i);
      if (!seen.has(id)) wrong.add(id);
    }
  }

  return [...wrong];
}

export type ErrorReviewStatus = "not_started" | "partial" | "done";

export type ErrorReviewEntry = {
  taskId: string;
  taskType: string;
  mode: ReviewMode;
  wrongItemIds: string[];
  correctedItemIds: string[];
  failedAttempts: Record<string, number>;
  remainingItemIds: string[];
  status: ErrorReviewStatus;
  total: number;
};

// Серверна модель одного завдання для блоку "Робота над помилками".
// mistakeRows — ВСІ рядки mistakes цього (студент, завдання), у будь-якому
// порядку (сортує сама). correctedItemIds/failedAttempts — поточний стан
// із get_mistake_correction_state (RPC, 0054). Для mode "whole"/"none" —
// повертає порожню "items"-частину моделі (status завжди "not_started",
// автоматичне "done" для "whole" поки не визначено, задокументовано в
// задачі — старий шлях через latestScoreByTask лишається джерелом правди
// для відображення "whole"-завдань).
export function buildErrorReviewEntry(params: {
  taskId: string;
  taskType: string;
  mistakeRows: MistakeRowLike[];
  correctedItemIds: string[];
  failedAttempts: Record<string, number>;
  // Актуальний config завдання — для звірки wrongItemIds проти привидів
  // (крок 2). Опційний: не переданий чи null — поведінка як раніше, без
  // звірки (назад сумісно з будь-яким викликачем, що config не має).
  config?: Record<string, unknown> | null;
}): ErrorReviewEntry {
  const mode = reviewMode(params.taskType);

  // whole-режим з реальною практикою (частина 7, хвиля 3) — "елемент" тут
  // рівно один, WHOLE_TASK_ITEM_ID: сам факт присутності завдання в
  // sceneMistakes (page.tsx: score !== 100, часткові бали теж помилка) уже
  // означає "неправильно", тож wrongItemIds завжди [WHOLE_TASK_ITEM_ID] —
  // mistakeRows тут не аналізуються (на відміну від items-режиму, де
  // aggregateWrongItems потрібен для блокових вправ). status — лише
  // not_started/done, "partial" для цілого завдання не застосовується (за
  // дизайном задачі).
  if (mode === "whole" && isWholePracticeTaskType(params.taskType)) {
    const isDone = params.correctedItemIds.includes(WHOLE_TASK_ITEM_ID);
    return {
      taskId: params.taskId,
      taskType: params.taskType,
      mode,
      wrongItemIds: [WHOLE_TASK_ITEM_ID],
      correctedItemIds: params.correctedItemIds,
      failedAttempts: params.failedAttempts,
      remainingItemIds: isDone ? [] : [WHOLE_TASK_ITEM_ID],
      status: isDone ? "done" : "not_started",
      total: 1,
    };
  }

  if (mode !== "items") {
    return {
      taskId: params.taskId,
      taskType: params.taskType,
      mode,
      wrongItemIds: [],
      correctedItemIds: [],
      failedAttempts: {},
      remainingItemIds: [],
      status: "not_started",
      total: 0,
    };
  }

  const wrongItemIds = aggregateWrongItems(params.mistakeRows, params.taskType, params.config);
  const correctedSet = new Set(params.correctedItemIds);
  const remainingItemIds = wrongItemIds.filter((id) => !correctedSet.has(id));
  const status: ErrorReviewStatus =
    wrongItemIds.length > 0 && remainingItemIds.length === 0
      ? "done"
      : correctedSet.size > 0
        ? "partial"
        : "not_started";

  return {
    taskId: params.taskId,
    taskType: params.taskType,
    mode,
    wrongItemIds,
    correctedItemIds: params.correctedItemIds,
    failedAttempts: params.failedAttempts,
    remainingItemIds,
    status,
    total: wrongItemIds.length,
  };
}

// "Робота над помилками", сцена-вигляд (/cabinet/mistakes/[sceneId],
// error-review-block.tsx) — чіпи-перемикач вправ над плашкою. ПОРЯДОК
// чипів (capturedOrder) — захоплюється викликачем ОДИН раз на монтуванні
// (useState-ініціалізатор, той самий принцип, що snapshot у цьому ж
// файлі для remainingItemIds) з ПЕРШОГО entries, що компонент отримав —
// стабільний, не зсувається після router.refresh(), коли якась задача
// зникає з liveEntries (повністю виправлена). СТАТУС кожного чипа —
// завжди зі СВІЖИХ liveEntries (не з капчурнутого порядку): "виправлено"
// рахується як "ця задача взагалі зникла з liveEntries" (score сягнув
// 100%, loadSceneErrorReviewEntries вже не вважає її помилкою) ЧИ "лишилась,
// але review.status уже 'done'" (усі колись неправильні елементи вже
// правильні, хоч загальний score ще не 100% — напр. підказки зняли бали) —
// обидва варіанти означають "у чипі нема більше що виправляти". activeTaskId
// (відкрита зараз задача) МАЄ ПЕРШИЙ ПРІОРИТЕТ над "виправлено": студент,
// який щойно сам виправив останній елемент відкритої задачі, має й далі
// бачити цей чип як "поточний" (індиго), не як "виправлено" (приглушений,
// недоступний) — доки сам не переключиться на інший чи не повернеться до
// списку.
export type MistakesChipStatus = "current" | "unfixed" | "fixed";

export type MistakesChip = {
  taskId: string;
  // 1-based позиція в capturedOrder — підпис чипа (номер), НЕЗАЛЕЖНО від
  // живого стану.
  index: number;
  status: MistakesChipStatus;
};

export function deriveMistakesChips(
  capturedOrder: string[],
  liveEntries: { taskId: string; status: ErrorReviewStatus }[],
  activeTaskId: string | null
): MistakesChip[] {
  const liveByTaskId = new Map(liveEntries.map((e) => [e.taskId, e]));
  return capturedOrder.map((taskId, i) => {
    const live = liveByTaskId.get(taskId);
    const isFixed = !live || live.status === "done";
    const status: MistakesChipStatus = taskId === activeTaskId ? "current" : isFixed ? "fixed" : "unfixed";
    return { taskId, index: i + 1, status };
  });
}

// Чип "Усі вправи" (мистейки-сторінка, openMode="scene") — тепер завжди
// видимий поряд із номерними чипами (задача "chip row always visible"),
// тож йому теж треба власний "активний" стан: активний рівно тоді, коли
// жодна вправа не відкрита (список), symmetric з deriveMistakesChips вище
// (там null у activeTaskId означає "жоден номерний чип не current").
export function isAllChipActive(openTaskId: string | null): boolean {
  return openTaskId === null;
}

// Заголовок-інструкція практики ("Робота над помилками" — задача
// "duplicate instruction header") — ErrorReviewPractice (error-review-
// block.tsx) малює ОДИН спільний TaskPanelHeader для типів, чия ВЛАСНА
// гілка isPractice сама жодного заголовка не рендерить, щоб не
// дублювати. Три категорії за тим, що компонент типу насправді робить:
//
// - "always" — ОДИН return на весь компонент (TaskPanelHeader/.task-
//   panel-header поза isPractice-умовою) — fill_blank/sort_columns/
//   checkbox_grid/chronological_order. Власний заголовок завжди є,
//   обгортка НЕ додає свій у жодному flow, інакше рядок інструкції
//   показується двічі (саме цей баг — commit, що додав спільний
//   TaskPanelHeader для "типів без заголовка", не врахував, що ці 4 типи
//   вже мають його завжди, не лише поза практикою).
// - "sceneOnly" — letter_rearrangement/letter_gaps/matching/table_fill:
//   `if (isPractice && isSceneMode)` — власний заголовок лише коли
//   практика отримала practice.scene (ErrorReviewOpenedTask,
//   openMode="scene"), у flat-режимі (інлайн-картка на сторінці сцени,
//   snapshotIds не передано) власного заголовка немає.
// - решта 7 (multiple_choice/true_false/word_choice/listening/reorder/
//   drag_drop/image_match) — `if (isPractice) return (...)` узагалі без
//   TaskPanelHeader — власного заголовка в практиці немає НІКОЛИ,
//   обгортка додає свій в обох flow (дефолт нижче, не в жодному Set).
export type ErrorReviewPracticeFlow = "flat" | "scene";

export const OWN_HEADER_ALWAYS_TASK_TYPES = new Set([
  "fill_blank",
  "sort_columns",
  "checkbox_grid",
  "chronological_order",
]);

export const OWN_HEADER_SCENE_ONLY_TASK_TYPES = new Set([
  "letter_rearrangement",
  "letter_gaps",
  "matching",
  "table_fill",
]);

export function shouldRenderWrapperHeader(taskType: string, flow: ErrorReviewPracticeFlow): boolean {
  if (OWN_HEADER_ALWAYS_TASK_TYPES.has(taskType)) return false;
  if (OWN_HEADER_SCENE_ONLY_TASK_TYPES.has(taskType)) return flow === "flat";
  return true;
}

// Задача "fill_blank practice: show solved words instead of dashed dots" —
// які пропуски безпечно показати студенту як готове слово (замість "···")
// у режимі практики. Правило: fill_blank градує ВСІ пропуски разом в
// ОДНОМУ submit (gradeFillBlank — studentAnswers[i] ?? "", жодного
// "негradованого" стану не існує), і aggregateWrongItems бере лише
// НАЙНОВІШИЙ валідний (positionalCount-сумісний) рядок mistakes — тож коли
// wrongItemIds НЕПОРОЖНІЙ, це означає, що ЩОНАЙМЕНШЕ один валідний рядок
// дійсно оцінив КОЖЕН пропуск поточного template. Пропуск поза
// remainingItemIds тоді — підтверджено правильний: або (а) його там
// ніколи не було (правильний з найостаннішої спроби), або (б) він був,
// але вже виправлений (correctedItemIds, practice/check: correctedSet.add
// лише на r.correct===true, НІКОЛИ з practice/reveal — показ відповіді не
// позначає елемент виправленим). Коли ж wrongItemIds ПОРОЖНІЙ — жодного
// валідного рядка взагалі не було (шаблон змінили після всіх історичних
// спроб, positionalCount-фільтр відкинув усе) — тоді ЖОДЕН пропуск не має
// підтвердження, і функція свідомо повертає [] (лишити нейтральні "···"
// для всіх, а не вгадувати).
export function confirmedSolvedBlankIds(
  blankCount: number,
  wrongItemIds: string[],
  remainingItemIds: string[]
): string[] {
  if (wrongItemIds.length === 0) return [];
  const remainingSet = new Set(remainingItemIds);
  const solved: string[] = [];
  for (let i = 0; i < blankCount; i++) {
    const id = String(i);
    if (!remainingSet.has(id)) solved.push(id);
  }
  return solved;
}

// Задача "unify attempt/reveal behaviour" — продуктове рішення: practice
// НІКОЛИ не розкриває відповідь автоматично, в жодному з двох потоків
// (інлайн-блок сцени, /cabinet/mistakes/[sceneId]). Раніше інлайн-потік
// (і, для 11 типів без isSceneMode-розгалуження взагалі, і сцена-вигляд
// теж) мав цикл reveal(itemId, false) після 2 невдалих спроб — усі такі
// викови видалені з компонентів; ЄДИНИЙ спосіб розкрити відповідь тепер —
// кнопка/пілюля "Відповідь" (reveal(id, true), fromButton=true), той самий
// серверний гейт (practice/reveal/route.ts) і кеш лишаються незмінними.
// Ця функція — не перевірка якогось умовного стану (параметрів немає
// навмисно), а єдина, тестована точка документування самого правила:
// жоден компонент більше не має власної "якщо спроби >= 2" логіки
// розкриття, лише цей константний факт.
export function shouldAutoReveal(): false {
  return false;
}

// Футер "Не вдалося · спроба N" (крапки спроб) — спільна умова для всіх
// типів з таким футером (letter_rearrangement/letter_gaps/table_fill,
// обидва потоки тепер однакові): показуємо його, коли остання перевірка
// цього елемента/завдання невдала і відповідь ще не розкрита. Розкрита
// відповідь (itemRevealed) замінює футер на сам рядок "Правильне
// слово: ..." — показувати крапки спроб ПІСЛЯ розкриття було б зайвим
// повтором того самого факту.
export function shouldShowAttemptFooter(isCorrect: boolean | undefined, itemRevealed: unknown): boolean {
  return practiceAttemptFooterState(isCorrect, itemRevealed) === "failed";
}

// Задача "unify attempt/status footer" — узагальнена версія умови вище,
// як ОДИН дискримінатор на 4 стани замість окремого booleana на
// кожен(ПРО кожен тип): "revealed" (відповідь уже розкрита — має
// пріоритет, той самий порядок перевірки, що й раніше в
// shouldShowAttemptFooter) > "failed" (остання перевірка невдала) >
// "correct" (зарахована) > "idle" (ще не перевірялось). Спільний
// компонент PracticeAttemptFooter (practice-attempt-footer.tsx) бере
// РІВНО цей стан, щоб 15 типів практики не повторювали один і той
// самий ternary.
export type PracticeAttemptFooterState = "idle" | "failed" | "correct" | "revealed";

export function practiceAttemptFooterState(
  isCorrect: boolean | undefined,
  itemRevealed: unknown
): PracticeAttemptFooterState {
  if (itemRevealed) return "revealed";
  if (isCorrect === false) return "failed";
  if (isCorrect === true) return "correct";
  return "idle";
}

// Кількість заповнених крапок спроб — та сама межа (3), що вже скрізь
// інлайн (Math.min(attempts, 3)) у кожному типі практики; винесено в
// один чистий helper, щоб не повторювати магічне число 15 разів і щоб
// його можна було протестувати окремо від React-розмітки.
export function dotsFilledCount(failedAttempts: number): number {
  return Math.min(failedAttempts, 3);
}

// Задача "attempt footer disappears right after a failed check" (owner
// report, letter_gaps, інлайн-блок помилок сторінки сцени) — корінь:
// кожен тип практики (11 items-типів) стежить за onlyItemIdsKey
// (practice.onlyItemIds.join(",")) і, щойно вона змінюється між
// рендерами, робив setPracticeResults({}) — ПОВНЕ скидання. Але
// onlyItemIds (інлайн-потік — ЖИВИЙ entry.remainingItemIds, не знімок)
// змінюється після КОЖНОГО router.refresh() (usePracticeCheck.check
// викликає його завжди, навіть для неправильної відповіді) — не лише
// членством (елемент виправлено й зник), а й ПОРЯДКОМ (сервер
// перераховує wrongItemIds із mistakeRows, найновіший рядок іде
// першим — aggregateWrongItems, сортування за createdAt — тож той
// самий НАБІР id у новому порядку вже й сам змінює join(",")-рядок).
// Повне скидання губило isCorrect:false (і тим самим ховало
// PracticeAttemptFooter), хоча елемент і далі неправильний і далі в
// onlyItemIds — просто на іншій позиції рядка/масиву.
//
// pruneStaleResults — те саме "почисти застарілі записи", але ТОЧКОВО:
// лишає запис для кожного id, що й досі є в currentIds (незалежно від
// позиції), видаляє лише записи для id, яких уже немає (виправлені й
// зникли, чи взагалі вийшли зі скоупу) — саме ТАКА була продуктова
// мета коментаря біля кожного виклику ("щоб застарілий ✓/✕ не лишався
// для вже ІНШИХ елементів"), без побічного знищення стану елементів,
// що й далі на екрані.
export function pruneStaleResults<T>(prevResults: Record<string, T>, currentIds: string[]): Record<string, T> {
  const idSet = new Set(currentIds);
  const next: Record<string, T> = {};
  for (const [id, value] of Object.entries(prevResults)) {
    if (idSet.has(id)) next[id] = value;
  }
  return next;
}

// Задача "replace red per-pair lines with collapsible answers panel"
// (matching, флет-практика) — замінює старий рядок-на-кожну-пару
// (matching.leftIncorrectRetry + окрема пілюля "Відповідь") одним
// спільним футером (крапки спроб + ОДНА панель TaskResult, той самий
// компонент, що сцена-вигляд блоків matching.tsx). Обидва нижче —
// ЧИСТІ функції агрегації, без React/практики, щоб їх можна було
// протестувати незалежно від компонента.
//
// stillWrongIds — підмножина ids, що й досі неправильні (ключ
// resultById[id] === false СУВОРО, не undefined — непроставлене (ще не
// перевірене) чи виправлене (true) не входить). Спільна для БУДЬ-ЯКОГО
// items-типу з per-item practiceResults (matching — за left-рядком,
// multiple_choice/word_choice/drag_drop/image_match — за item.id).
export function stillWrongIds(ids: string[], resultById: Record<string, boolean | undefined>): string[] {
  return ids.filter((id) => resultById[id] === false);
}

// maxFailedAttempts — найгірший (максимальний) attempts серед заданих
// id (0, якщо список порожній чи жодного запису немає) — те саме
// число, що й на крапках спроб кожного окремого елемента інших типів
// (practiceFailedAttempts[id]), лише зведене до ОДНОГО числа на весь
// футер.
export function maxFailedAttempts(ids: string[], failedAttempts: Record<string, number | undefined>): number {
  return ids.reduce((max, id) => Math.max(max, failedAttempts[id] ?? 0), 0);
}
