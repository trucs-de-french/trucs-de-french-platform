import { HINT_EXPLANATIONS, HINTS_REDUCE_POINTS_SUFFIX } from "@/lib/exercises/hints";

// Текст лампочки-підказки (TaskPanelHeader, task-panel-header.tsx) — лише
// для типів із записом у HINT_EXPLANATIONS; решта повертає null (викликач
// тоді просто не передає hintText далі, і пілюля не рендериться).
// includeHalfPointsSuffix — лише word_choice передає false (задача:
// прибрати речення "Слово з підказкою дає половину балів." саме там,
// половинні бали самі лишаються без змін, прибирається тільки текст
// пілюлі); усі інші 7 викликачів лишають дефолт true, їхній текст не
// змінюється.
export function hintExplanationText(
  type: string,
  hintsReducePoints: boolean,
  includeHalfPointsSuffix = true
): string | null {
  const text = HINT_EXPLANATIONS[type];
  if (!text) return null;
  return hintsReducePoints && includeHalfPointsSuffix ? `${text}${HINTS_REDUCE_POINTS_SUFFIX}` : text;
}
