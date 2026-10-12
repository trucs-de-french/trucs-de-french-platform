// "Робота над помилками", пілот частина 1 — чисті функції (без React/
// Supabase), спільні для сервера (page.tsx, practice/check, practice/reveal)
// і майбутнього клієнта (частина 2, редизайн вигляду). Жодна з них не читає
// БД і не має побічних ефектів.

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
] as const;
export type PracticeItemsTaskType = (typeof PRACTICE_ITEMS_TASK_TYPES)[number];

// Повна класифікація "items" (мета-ціль пілота, задача 2) — елементи, що
// підлягають переробці поокремо. Наразі лише PRACTICE_ITEMS_TASK_TYPES з
// цього списку мають реальну реалізацію mistakeItemIds/itemsInDetail —
// решта тут лише документує майбутній план, reviewMode() для них повертає
// "whole".
const ITEMS_MODE_TASK_TYPES = ["open_answer", "listening"] as const;

// Класифікація "whole" (переробляється ЦІЛЕ завдання, не елемент) —
// остаточна, не тимчасова.
const WHOLE_MODE_TASK_TYPES = [
  "reorder",
  "chronological_order",
  "sort_columns",
  "checkbox_grid",
] as const;

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

  return null;
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
export function aggregateWrongItems(rows: MistakeRowLike[], taskType: string): string[] {
  const sorted = [...rows].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  const seen = new Set<string>();
  const wrong = new Set<string>();

  for (const row of sorted) {
    const ids = itemsInDetail(taskType, row.detail);
    if (!ids) continue;
    const wrongIds = new Set(mistakeItemIds(taskType, row.detail) ?? []);
    for (const id of ids) {
      if (seen.has(id)) continue;
      seen.add(id);
      if (wrongIds.has(id)) wrong.add(id);
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
}): ErrorReviewEntry {
  const mode = reviewMode(params.taskType);

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

  const wrongItemIds = aggregateWrongItems(params.mistakeRows, params.taskType);
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
