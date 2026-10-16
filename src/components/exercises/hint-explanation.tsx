import { HINT_EXPLANATIONS, HINTS_REDUCE_POINTS_SUFFIX } from "@/lib/exercises/hints";

// Текст лампочки-підказки (TaskPanelHeader, task-panel-header.tsx) — лише
// для типів із записом у HINT_EXPLANATIONS; решта повертає null (викликач
// тоді просто не передає hintText далі, і пілюля не рендериться).
export function hintExplanationText(type: string, hintsReducePoints: boolean): string | null {
  const text = HINT_EXPLANATIONS[type];
  if (!text) return null;
  return hintsReducePoints ? `${text}${HINTS_REDUCE_POINTS_SUFFIX}` : text;
}
