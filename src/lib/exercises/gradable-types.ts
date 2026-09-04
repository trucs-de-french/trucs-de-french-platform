// Єдине джерело правди для списку типів завдань з автоперевіркою — раніше
// цей самий набір рядків був продубльований у 4 місцях (GRADABLE_TYPES у
// api/exercises/check/route.ts, EXERCISE_TYPES у exercise-card.tsx, і
// неявно — у case-гілках grade.ts та sanitize.ts), що легко розсинхронізувати
// при додаванні нового типу. Тепер усі чотири імпортують звідси.
export const GRADABLE_TASK_TYPES = [
  "fill_blank",
  "multiple_choice",
  "true_false",
  "matching",
  "listening",
  "reorder",
  "drag_drop",
  "sort_columns",
  "open_answer",
  "table_fill",
  "image_match",
] as const;

export type GradableTaskType = (typeof GRADABLE_TASK_TYPES)[number];

export function isGradableTaskType(type: string): type is GradableTaskType {
  return (GRADABLE_TASK_TYPES as readonly string[]).includes(type);
}

// Використовується в default-гілці exhaustive switch у grade.ts/sanitize.ts:
// якщо додати новий тип у GRADABLE_TASK_TYPES і забути обробити його там,
// TypeScript не дасть скомпілюватись (type звузиться не до never), а не
// впаде мовчки в рантаймі лише коли хтось цей тип реально здасть.
export function assertNeverGradableType(value: never): never {
  throw new Error(`Немає обробки для типу завдання "${value}"`);
}

// Пілот системи балів (points_visible на tasks) — типи, чиї config/grade.ts
// уже рахують pointsEarned/pointsPossible поряд зі score. Розширюється по
// одному типу за раз (Група A); чекбокс "Показувати бали заздалегідь" у
// task-config-fields.tsx рендериться лише для типів із цього списку —
// свідомо не для всіх GRADABLE_TASK_TYPES одразу, щоб не показувати
// перемикач, який ще нічого не робить для типу, який ще не підтримує бали.
export const POINTS_SUPPORTED_TASK_TYPES = ["true_false", "open_answer"] as const;

export function isPointsSupportedTaskType(type: string): boolean {
  return (POINTS_SUPPORTED_TASK_TYPES as readonly string[]).includes(type);
}
