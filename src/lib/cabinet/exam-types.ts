// Варіанти exam_type — власні назви іспитів, не перекладаються жодною
// мовою інтерфейсу (той самий рядок в uk/fr/en), тож тут і лише тут, а не
// в i18n-словниках. Окремий звичайний модуль (не "use server"/"use client"),
// бо з "use server"-файлу клієнтський код може імпортувати лише async-функції.
export const EXAM_TYPE_OPTIONS = [
  "DELF A1",
  "DELF A2",
  "DELF B1",
  "DELF B2",
  "DALF C1",
  "DALF C2",
  "TCF",
  "TEF",
] as const;

export type ExamType = (typeof EXAM_TYPE_OPTIONS)[number];

export function isExamType(value: string): value is ExamType {
  return (EXAM_TYPE_OPTIONS as readonly string[]).includes(value);
}
