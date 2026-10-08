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
// елементів) лише для цих двох типів. Решта типів класифікації "items"
// нижче тимчасово повертають "whole", доки не реалізовані.
export const PRACTICE_ITEMS_TASK_TYPES = ["multiple_choice", "fill_blank"] as const;
export type PracticeItemsTaskType = (typeof PRACTICE_ITEMS_TASK_TYPES)[number];

// Повна класифікація "items" (мета-ціль пілота, задача 2) — елементи, що
// підлягають переробці поокремо. Наразі лише PRACTICE_ITEMS_TASK_TYPES з
// цього списку мають реальну реалізацію mistakeItemIds/itemsInDetail —
// решта тут лише документує майбутній план, reviewMode() для них повертає
// "whole".
const ITEMS_MODE_TASK_TYPES = [
  "fill_blank",
  "letter_gaps",
  "letter_rearrangement",
  "multiple_choice",
  "word_choice",
  "true_false",
  "matching",
  "drag_drop",
  "open_answer",
  "table_fill",
  "image_match",
  "listening",
] as const;

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
