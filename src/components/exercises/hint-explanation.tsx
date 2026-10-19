import { HINT_EXPLANATIONS } from "@/lib/exercises/hints";

// Текст лампочки-підказки (TaskPanelHeader, task-panel-header.tsx) — лише
// для типів із записом у HINT_EXPLANATIONS; решта повертає null (викликач
// тоді просто не передає hintText далі, і пілюля не рендериться). Фраза
// "підказка дає половину балів" більше не йде в текст пілюлі — вона одна
// спільна смужка під заголовком "Завдання" (hints.ts, taskHintReducesPoints).
export function hintExplanationText(type: string): string | null {
  return HINT_EXPLANATIONS[type] ?? null;
}
