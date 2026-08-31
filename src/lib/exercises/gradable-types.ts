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
